/* Supabase data layer for the AV Muslim School website. */
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  const configured=!!cfg.url && !!cfg.key && !String(cfg.url).includes('PASTE_YOUR_') && !String(cfg.key).includes('PASTE_YOUR_');
  window.sb=configured ? window.supabase.createClient(cfg.url,cfg.key) : null;
  function ensure(){if(!window.sb) throw new Error('Supabase is not configured yet. Edit supabase-config.js with your Project URL and Publishable key.');}

  async function getSession(){
    ensure();
    const {data,error}=await sb.auth.getSession();
    if(error) throw error;
    return data.session;
  }
  async function requireAdmin(){
    const session=await getSession();
    if(!session) throw new Error('Please log in as administrator.');
    const {data,error}=await sb.from('admins').select('id,username,display_name,auth_user_id').eq('auth_user_id',session.user.id).maybeSingle();
    if(error) throw error;
    if(!data) throw new Error('This account is authenticated but is not registered as an administrator. Add its Auth User ID to public.admins.auth_user_id.');
    return {session,profile:data};
  }
  function body(opt){
    try{return JSON.parse(opt?.body||'{}')}catch{return {}}
  }
  async function api(action,opt={}){
    ensure();
    const b=body(opt);
    let data,error;
    switch(action){
      case 'login': {
        const email=(b.email||b.username||'').trim();
        const r=await sb.auth.signInWithPassword({email,password:b.password||''});
        data=r.data; error=r.error;
        if(error) throw error;
        await requireAdmin();
        return {success:true,admin:{name:(data.user.user_metadata?.display_name||email)}};
      }
      case 'logout': { const r=await sb.auth.signOut(); if(r.error)throw r.error; return {success:true}; }
      case 'session': {
        const session=await getSession();
        if(!session) return {success:true,logged_in:false,admin:{name:''}};
        const {profile}=await requireAdmin();
        return {success:true,logged_in:true,admin:{name:profile.display_name||session.user.email}};
      }
      case 'dashboard': {
        await requireAdmin();
        const [a,t,c,s]=await Promise.all([
          sb.from('students').select('id',{count:'exact',head:true}).eq('status','active'),
          sb.from('teachers').select('id',{count:'exact',head:true}).eq('status','active'),
          sb.from('classes').select('id',{count:'exact',head:true}),
          sb.from('sections').select('id',{count:'exact',head:true})
        ]); const x=[a,t,c,s].find(r=>r.error); if(x?.error)throw x.error;
        return {success:true,students:a.count||0,teachers:t.count||0,classes:c.count||0,sections:s.count||0};
      }
      case 'admin_students': {
        await requireAdmin();
        const r=await sb.from('students').select('id,roll_no:roll_no,name,father:father_name,admission_no,section_id,sections(name,class_id,classes(name)),status').order('name');
        if(r.error)throw r.error;
        return {success:true,rows:(r.data||[]).map(x=>({id:x.id,roll:x.roll_no,name:x.name,father:x.father,admission_no:x.admission_no,section_id:x.section_id,section_name:x.sections?.name||null,class_name:x.sections?.classes?.name||null,status:x.status}))};
      }
      case 'admin_teachers': {
        await requireAdmin(); const r=await sb.from('teachers').select('*').order('name'); if(r.error)throw r.error; return {success:true,rows:r.data||[]};
      }
      case 'admin_classes': {
        await requireAdmin();
        const [a,b]=await Promise.all([sb.from('classes').select('*').order('id'),sb.from('sections').select('*,classes(name)').order('class_id').order('id')]);
        if(a.error)throw a.error;if(b.error)throw b.error;
        return {success:true,classes:a.data||[],sections:(b.data||[]).map(x=>({...x,class_name:x.classes?.name||''}))};
      }
      case 'admin_exams': { await requireAdmin(); const r=await sb.from('exams').select('*').order('id',{ascending:false});if(r.error)throw r.error;return {success:true,rows:r.data||[]}; }
      case 'save_student': {
        await requireAdmin();
        const row={roll_no:b.roll||null,name:b.name||'',father_name:b.father||null,admission_no:b.admission_no||null,section_id:b.section_id?Number(b.section_id):null};
        const r=b.id?await sb.from('students').update(row).eq('id',b.id):await sb.from('students').insert(row); if(r.error)throw r.error; return {success:true};
      }
      case 'delete_student': { await requireAdmin(); const r=await sb.from('students').update({status:'inactive'}).eq('id',b.id);if(r.error)throw r.error;return {success:true}; }
      case 'save_teacher': {
        await requireAdmin(); const row={name:b.name||'',designation:b.designation||null,qualification:b.qualification||null,phone:b.phone||null,email:b.email||null}; const r=b.id?await sb.from('teachers').update(row).eq('id',b.id):await sb.from('teachers').insert(row);if(r.error)throw r.error;return {success:true};
      }
      case 'delete_teacher': { await requireAdmin(); const r=await sb.from('teachers').update({status:'inactive'}).eq('id',b.id);if(r.error)throw r.error;return {success:true}; }
      case 'save_class': { await requireAdmin(); const r=b.id?await sb.from('classes').update({name:b.name}).eq('id',b.id):await sb.from('classes').insert({name:b.name});if(r.error)throw r.error;return {success:true}; }
      case 'save_section': { await requireAdmin(); const row={class_id:Number(b.class_id),name:b.name};const r=b.id?await sb.from('sections').update(row).eq('id',b.id):await sb.from('sections').insert(row);if(r.error)throw r.error;return {success:true}; }
      case 'save_exam': { await requireAdmin(); const row={name:b.name,academic_year:b.academic_year,is_published:!!b.is_published,is_demo:!!b.is_demo};const r=b.id?await sb.from('exams').update(row).eq('id',b.id):await sb.from('exams').insert(row);if(r.error)throw r.error;return {success:true}; }
      case 'save_result': {
        await requireAdmin();
        const student_id=Number(b.student_id),exam_id=Number(b.exam_id),subs=b.subjects||[];
        if(!student_id||!exam_id||!subs.length) throw new Error('Select a student, examination and at least one subject.');
        const total=subs.reduce((n,x)=>n+Number(x.total||0),0), obtained=subs.reduce((n,x)=>n+Number(x.obtained||0),0), percentage=total?Math.round(obtained/total*10000)/100:0;
        const grade=percentage>=90?'A+':percentage>=80?'A':percentage>=70?'B+':percentage>=60?'B':percentage>=50?'C':'F';
        let rr=await sb.from('results').select('id').eq('student_id',student_id).eq('exam_id',exam_id).maybeSingle();
        if(rr.error) throw rr.error;
        let resultId;
        if(rr.data){
          const u=await sb.from('results').update({total_marks:total,obtained_marks:obtained,percentage,grade,is_demo:false}).eq('id',rr.data.id).select('id').single();
          if(u.error) throw u.error; resultId=u.data.id;
        } else {
          const i=await sb.from('results').insert({student_id,exam_id,total_marks:total,obtained_marks:obtained,percentage,grade,is_demo:false}).select('id').single();
          if(i.error) throw i.error; resultId=i.data.id;
        }
        const del=await sb.from('result_subjects').delete().eq('result_id',resultId);
        if(del.error) throw del.error;
        for(const x of subs){
          let sr=await sb.from('subjects').select('id').eq('name',x.name).maybeSingle();
          if(sr.error) throw sr.error;
          let sid=sr.data?.id;
          if(!sid){
            const ins=await sb.from('subjects').insert({name:x.name}).select('id').single();
            if(ins.error) throw ins.error; sid=ins.data.id;
          }
          const ir=await sb.from('result_subjects').insert({result_id:resultId,subject_id:sid,total_marks:Number(x.total),obtained_marks:Number(x.obtained)});
          if(ir.error) throw ir.error;
        }
        return {success:true,percentage,grade};
      }
      case 'admin_admissions': { await requireAdmin(); const r=await sb.from('admissions').select('*').order('id',{ascending:false});if(r.error)throw r.error;return {success:true,rows:r.data||[]}; }
      case 'update_admission_status': { await requireAdmin(); if(!['Pending','Approved','Rejected'].includes(b.status))throw new Error('Invalid admission status.');const r=await sb.from('admissions').update({status:b.status}).eq('id',b.id);if(r.error)throw r.error;return {success:true}; }
      case 'admission_apply': {
        const required=['student_name','father_name','dob','gender','class_name','phone','address']; for(const k of required)if(!String(b[k]??'').trim())throw new Error('Please fill all required fields.');
        const application_no='ADM-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(Math.floor(Math.random()*10000)).padStart(4,'0');
        const r=await sb.from('admissions').insert({application_no,student_name:b.student_name,father_name:b.father_name,dob:b.dob,gender:b.gender,class_name:b.class_name,previous_school:b.previous_school||'',phone:b.phone,email:b.email||'',address:b.address,status:'Pending'}).select('application_no').single();if(r.error)throw r.error;return {success:true,application_no:r.data.application_no};
      }
      case 'content': { const r=await sb.from('school_content').select('content_key,content_value');if(r.error)throw r.error;const c={};(r.data||[]).forEach(x=>c[x.content_key]=x.content_value);return {success:true,content:c}; }
      case 'stories': { const r=await sb.from('school_stories').select('title,story_text:text').order('sort_order').order('id');if(r.error)throw r.error;return {success:true,stories:r.data||[]}; }
      case 'bootstrap': {
        const [c,s,t,r]=await Promise.all([
          sb.from('classes').select('id,legacy_id,name').order('id'),
          sb.from('sections').select('id,legacy_id,name,class_id,classes(name)').order('class_id').order('id'),
          sb.from('teachers').select('id,name,designation:designation,qualification:qualification,phone,email,status').eq('status','active').order('name'),
          sb.from('results').select('id,student_id,total_marks:total_marks,obtained_marks:obtained_marks,percentage,grade,exams!inner(is_published,is_demo),result_subjects(total_marks,obtained_marks,subjects(name))').eq('exams.is_published',true)
        ]);for(const z of [c,s,t,r])if(z.error)throw z.error;
        const students=await sb.from('students').select('id,legacy_id,roll:roll_no,name,father:father_name,section_id,section_legacy_id').eq('status','active').order('name');if(students.error)throw students.error;
        return {success:true,classes:c.data||[],sections:(s.data||[]).map(x=>({...x,class_name:x.classes?.name||''})),students:students.data||[],teachers:t.data||[],results:(r.data||[]).map(x=>({id:x.id,student_id:x.student_id,total:x.total_marks,obtained:x.obtained_marks,percentage:x.percentage,grade:x.grade,subjects:(x.result_subjects||[]).map(y=>({name:y.subjects?.name,total:y.total_marks,obtained:y.obtained_marks}))}))};
      }
      case 'public_search': {
        const term=(b.roll||'').trim()||null,name=(b.name||'').trim()||null;let q=sb.from('students').select('id,roll_no,name,father_name,section_id').eq('status','active').limit(1);if(term)q=q.eq('roll_no',term);else q=q.ilike('name',name);const st=await q.maybeSingle();if(st.error)throw st.error;if(!st.data)return {success:true,student:null,result:null};
        const r=await sb.from('results').select('id,total_marks,obtained_marks,percentage,grade,exams!inner(is_published),result_subjects(total_marks,obtained_marks,subjects(name))').eq('student_id',st.data.id).eq('exams.is_published',true).order('id',{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;let result=null;if(r.data)result={id:r.data.id,total:r.data.total_marks,obtained:r.data.obtained_marks,percentage:r.data.percentage,grade:r.data.grade,subjects:(r.data.result_subjects||[]).map(x=>({name:x.subjects?.name,total:x.total_marks,obtained:x.obtained_marks}))};return {success:true,student:{id:st.data.id,roll:st.data.roll_no,name:st.data.name,father:st.data.father_name},result};
      }
      case 'whole_school_report': {
        await requireAdmin();const r=await sb.from('results').select('total_marks,obtained_marks,percentage,students!inner(roll_no,name,sections!inner(classes(name))),exams!inner(is_published)').eq('exams.is_published',true).order('student_id');if(r.error)throw r.error;return {success:true,rows:(r.data||[]).map(x=>({roll:x.students.roll_no,student_name:x.students.name,class_name:x.students.sections?.classes?.name||'',total_marks:x.total_marks,obtained_marks:x.obtained_marks,percentage:x.percentage}))};
      }
      default: throw new Error('Unknown action: '+action);
    }
  }
  window.api=api;
})();
