<?php
declare(strict_types=1);
session_start();
$cfg=file_exists(__DIR__.'/config.local.php') ? require __DIR__.'/config.local.php' : require __DIR__.'/config.php';
header('Content-Type: application/json; charset=utf-8');
function out($x, int $status=200): never { http_response_code($status); echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; }
function body(): array { $raw=file_get_contents('php://input'); $x=json_decode($raw?:'{}',true); return is_array($x)?$x:[]; }
try{$pdo=new PDO('mysql:host='.$cfg['db_host'].';dbname='.$cfg['db_name'].';charset=utf8mb4',$cfg['db_user'],$cfg['db_pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}catch(Throwable $e){out(['success'=>false,'message'=>'Database connection failed. Check config.local.php.'],500);}
function auth(bool $required=true): bool { $ok=!empty($_SESSION['admin_id']); if($required&&!$ok)out(['success'=>false,'message'=>'Please log in as administrator.'],401); return $ok; }
function grade(float $p): string {return $p>=90?'A+':($p>=80?'A':($p>=70?'B+':($p>=60?'B':($p>=50?'C':'F'))));}
$action=$_GET['action']??'';
try{
 if($action==='login'){ $b=body(); $st=$pdo->prepare('SELECT * FROM admins WHERE username=? LIMIT 1');$st->execute([$b['username']??'']);$a=$st->fetch();if($a&&password_verify($b['password']??'',$a['password_hash'])){$_SESSION['admin_id']=$a['id'];$_SESSION['admin_name']=$a['display_name'];out(['success'=>true,'admin'=>['name'=>$a['display_name']]]);}out(['success'=>false,'message'=>'Invalid username or password.'],401);}
 if($action==='logout'){session_destroy();out(['success'=>true]);}
 if($action==='session'){out(['success'=>true,'logged_in'=>!empty($_SESSION['admin_id']),'admin'=>['name'=>$_SESSION['admin_name']??'']]);}
 if($action==='bootstrap'){
  $classes=$pdo->query('SELECT id,legacy_id,name FROM classes ORDER BY id')->fetchAll();$sections=$pdo->query('SELECT s.id,s.legacy_id,s.name,s.class_id,c.name class_name FROM sections s LEFT JOIN classes c ON c.id=s.class_id ORDER BY s.class_id,s.id')->fetchAll();$students=$pdo->query("SELECT st.id,st.legacy_id,st.roll_no roll,st.name,st.father_name father,st.section_id,st.section_legacy_id FROM students st WHERE st.status='active' ORDER BY st.name")->fetchAll();$teachers=$pdo->query("SELECT id,name,designation role,qualification info,phone,email,status FROM teachers WHERE status='active' ORDER BY name")->fetchAll();
  $results=[];$q=$pdo->query("SELECT r.id,r.student_id,r.total_marks total,r.obtained_marks obtained,r.percentage,r.grade,e.is_published,e.is_demo FROM results r JOIN exams e ON e.id=r.exam_id WHERE e.is_published=1");foreach($q as $r){$r['subjects']=[];$x=$pdo->prepare('SELECT s.name,rs.total_marks total,rs.obtained_marks obtained FROM result_subjects rs JOIN subjects s ON s.id=rs.subject_id WHERE rs.result_id=? ORDER BY rs.id');$x->execute([$r['id']]);$r['subjects']=$x->fetchAll();$results[]=$r;}out(['success'=>true,'classes'=>$classes,'sections'=>$sections,'students'=>$students,'teachers'=>$teachers,'results'=>$results]);}
 if($action==='content'){ $rows=$pdo->query('SELECT content_key,content_value FROM school_content')->fetchAll();$c=[];foreach($rows as $r)$c[$r['content_key']]=$r['content_value'];out(['success'=>true,'content'=>$c]);}
 if($action==='stories'){out(['success'=>true,'stories'=>$pdo->query('SELECT title,story_text text FROM school_stories ORDER BY sort_order,id')->fetchAll()]);}
 if($action==='public_search'){ $b=body();$sql="SELECT * FROM students WHERE status='active' AND ";$args=[];if(!empty($b['roll'])){$sql.='roll_no=?';$args[]=$b['roll'];}else{$sql.='LOWER(name)=LOWER(?)';$args[]=$b['name']??'';} $sql.=' LIMIT 1';$st=$pdo->prepare($sql);$st->execute($args);$student=$st->fetch();if(!$student)out(['success'=>true,'student'=>null,'result'=>null]);$q=$pdo->prepare("SELECT r.id,r.total_marks total,r.obtained_marks obtained,r.percentage,r.grade FROM results r JOIN exams e ON e.id=r.exam_id WHERE r.student_id=? AND e.is_published=1 ORDER BY e.id DESC LIMIT 1");$q->execute([$student['id']]);$r=$q->fetch();if($r){$q=$pdo->prepare('SELECT s.name,rs.total_marks total,rs.obtained_marks obtained FROM result_subjects rs JOIN subjects s ON s.id=rs.subject_id WHERE rs.result_id=? ORDER BY rs.id');$q->execute([$r['id']]);$r['subjects']=$q->fetchAll();}out(['success'=>true,'student'=>['id'=>$student['id'],'roll'=>$student['roll_no'],'name'=>$student['name'],'father'=>$student['father_name']],'result'=>$r]);}
 if($action==='whole_school_report'){auth();$q=$pdo->query("SELECT st.roll_no roll,st.name student_name,c.name class_name,r.total_marks,r.obtained_marks,r.percentage FROM results r JOIN students st ON st.id=r.student_id JOIN sections s ON s.id=st.section_id JOIN classes c ON c.id=s.class_id JOIN exams e ON e.id=r.exam_id WHERE e.is_published=1 ORDER BY c.id,s.id,st.roll_no");out(['success'=>true,'rows'=>$q->fetchAll()]);}

 /* =========================================================
    ONLINE ADMISSIONS
    These actions are intentionally BEFORE the general auth()
    below because students/parents must be able to submit
    the public admission form without being logged in.
    ========================================================= */
 if($action==='admission_apply'){
     $b=body();

     $required=[
         'student_name',
         'father_name',
         'dob',
         'gender',
         'class_name',
         'phone',
         'address'
     ];

     foreach($required as $k){
         if(trim((string)($b[$k]??''))===''){
             out([
                 'success'=>false,
                 'message'=>'Please fill all required fields.'
             ],422);
         }
     }

     $applicationNo='ADM-'.date('Ymd').'-'.str_pad(
         (string)random_int(1,9999),
         4,
         '0',
         STR_PAD_LEFT
     );

     $st=$pdo->prepare(
         'INSERT INTO admissions
         (application_no,student_name,father_name,dob,gender,class_name,
          previous_school,phone,email,address)
         VALUES(?,?,?,?,?,?,?,?,?,?)'
     );

     $st->execute([
         $applicationNo,
         $b['student_name'],
         $b['father_name'],
         $b['dob'],
         $b['gender'],
         $b['class_name'],
         $b['previous_school']??'',
         $b['phone'],
         $b['email']??'',
         $b['address']
     ]);

     out([
         'success'=>true,
         'application_no'=>$applicationNo
     ]);
 }

 if($action==='admin_admissions'){
     auth();

     $rows=$pdo->query(
         'SELECT * FROM admissions ORDER BY id DESC'
     )->fetchAll();

     out([
         'success'=>true,
         'rows'=>$rows
     ]);
 }

 if($action==='update_admission_status'){
     auth();

     $b=body();
     $status=$b['status']??'Pending';

     if(!in_array($status,['Pending','Approved','Rejected'],true)){
         out([
             'success'=>false,
             'message'=>'Invalid admission status.'
         ],422);
     }

     $st=$pdo->prepare(
         'UPDATE admissions SET status=? WHERE id=?'
     );

     $st->execute([
         $status,
         (int)($b['id']??0)
     ]);

     out(['success'=>true]);
 }

 auth();
 if($action==='dashboard'){out(['success'=>true,'students'=>(int)$pdo->query("SELECT COUNT(*) FROM students WHERE status='active'")->fetchColumn(),'teachers'=>(int)$pdo->query("SELECT COUNT(*) FROM teachers WHERE status='active'")->fetchColumn(),'classes'=>(int)$pdo->query('SELECT COUNT(*) FROM classes')->fetchColumn(),'sections'=>(int)$pdo->query('SELECT COUNT(*) FROM sections')->fetchColumn()]);}
 if($action==='admin_students'){ $q=$pdo->query("SELECT st.id,st.roll_no roll,st.name,st.father_name father,st.admission_no,st.section_id,s.name section_name,c.name class_name,st.status FROM students st LEFT JOIN sections s ON s.id=st.section_id LEFT JOIN classes c ON c.id=s.class_id ORDER BY c.id,s.id,st.roll_no,st.name");out(['success'=>true,'rows'=>$q->fetchAll()]);}
 if($action==='admin_teachers'){out(['success'=>true,'rows'=>$pdo->query('SELECT * FROM teachers ORDER BY name')->fetchAll()]);}
 if($action==='admin_classes'){ $classes=$pdo->query('SELECT * FROM classes ORDER BY id')->fetchAll();$sections=$pdo->query('SELECT * FROM sections ORDER BY class_id,id')->fetchAll();out(['success'=>true,'classes'=>$classes,'sections'=>$sections]);}
 if($action==='admin_exams'){out(['success'=>true,'rows'=>$pdo->query('SELECT * FROM exams ORDER BY id DESC')->fetchAll()]);}
 if($action==='save_student'){ $b=body();$id=(int)($b['id']??0);if($id){$st=$pdo->prepare('UPDATE students SET roll_no=?,name=?,father_name=?,admission_no=?,section_id=? WHERE id=?');$st->execute([$b['roll']??null,$b['name']??'', $b['father']??null,$b['admission_no']??null,$b['section_id']?:null,$id]);}else{$st=$pdo->prepare('INSERT INTO students(roll_no,name,father_name,admission_no,section_id) VALUES(?,?,?,?,?)');$st->execute([$b['roll']??null,$b['name']??'', $b['father']??null,$b['admission_no']??null,$b['section_id']?:null]);}out(['success'=>true]);}
 if($action==='delete_student'){ $pdo->prepare("UPDATE students SET status='inactive' WHERE id=?")->execute([(int)body()['id']]);out(['success'=>true]);}
 if($action==='save_teacher'){ $b=body();$id=(int)($b['id']??0);if($id){$pdo->prepare('UPDATE teachers SET name=?,designation=?,qualification=?,phone=?,email=? WHERE id=?')->execute([$b['name']??'', $b['designation']??null,$b['qualification']??null,$b['phone']??null,$b['email']??null,$id]);}else{$pdo->prepare('INSERT INTO teachers(name,designation,qualification,phone,email) VALUES(?,?,?,?,?)')->execute([$b['name']??'', $b['designation']??null,$b['qualification']??null,$b['phone']??null,$b['email']??null]);}out(['success'=>true]);}
 if($action==='delete_teacher'){ $pdo->prepare("UPDATE teachers SET status='inactive' WHERE id=?")->execute([(int)body()['id']]);out(['success'=>true]);}
 if($action==='save_class'){ $b=body();$id=(int)($b['id']??0);if($id)$pdo->prepare('UPDATE classes SET name=? WHERE id=?')->execute([$b['name'],$id]);else$pdo->prepare('INSERT INTO classes(name) VALUES(?)')->execute([$b['name']]);out(['success'=>true]);}
 if($action==='save_section'){ $b=body();$id=(int)($b['id']??0);if($id)$pdo->prepare('UPDATE sections SET class_id=?,name=? WHERE id=?')->execute([(int)$b['class_id'],$b['name'],$id]);else$pdo->prepare('INSERT INTO sections(class_id,name) VALUES(?,?)')->execute([(int)$b['class_id'],$b['name']]);out(['success'=>true]);}
 if($action==='save_exam'){ $b=body();$id=(int)($b['id']??0);if($id)$pdo->prepare('UPDATE exams SET name=?,academic_year=?,is_published=?,is_demo=? WHERE id=?')->execute([$b['name'],$b['academic_year'],$b['is_published']?1:0,$b['is_demo']?1:0,$id]);else$pdo->prepare('INSERT INTO exams(name,academic_year,is_published,is_demo) VALUES(?,?,?,?)')->execute([$b['name'],$b['academic_year'],$b['is_published']?1:0,$b['is_demo']?1:0]);out(['success'=>true]);}
 if($action==='save_result'){ $b=body();$student=(int)$b['student_id'];$exam=(int)$b['exam_id'];$subs=$b['subjects']??[];$total=0;$obt=0;foreach($subs as $x){$total+=(float)$x['total'];$obt+=(float)$x['obtained'];}$pct=$total?round($obt/$total*100,2):0;$g=grade($pct);$pdo->beginTransaction();$pdo->prepare('INSERT INTO results(student_id,exam_id,total_marks,obtained_marks,percentage,grade,is_demo) VALUES(?,?,?,?,?,?,0) ON DUPLICATE KEY UPDATE total_marks=VALUES(total_marks),obtained_marks=VALUES(obtained_marks),percentage=VALUES(percentage),grade=VALUES(grade),is_demo=0')->execute([$student,$exam,$total,$obt,$pct,$g]);$rid=(int)$pdo->lastInsertId();if(!$rid){$q=$pdo->prepare('SELECT id FROM results WHERE student_id=? AND exam_id=?');$q->execute([$student,$exam]);$rid=(int)$q->fetchColumn();}$pdo->prepare('DELETE FROM result_subjects WHERE result_id=?')->execute([$rid]);foreach($subs as $x){$q=$pdo->prepare('SELECT id FROM subjects WHERE name=?');$q->execute([$x['name']]);$sid=(int)$q->fetchColumn();if(!$sid){$pdo->prepare('INSERT INTO subjects(name) VALUES(?)')->execute([$x['name']]);$sid=(int)$pdo->lastInsertId();}$pdo->prepare('INSERT INTO result_subjects(result_id,subject_id,total_marks,obtained_marks) VALUES(?,?,?,?)')->execute([$rid,$sid,(float)$x['total'],(float)$x['obtained']]);}$pdo->commit();out(['success'=>true,'percentage'=>$pct,'grade'=>$g]);}
 out(['success'=>false,'message'=>'Unknown action.'],404);
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();out(['success'=>false,'message'=>$e->getMessage()],500);}
