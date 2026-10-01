let S={students:[],teachers:[],classes:[],sections:[],exams:[],admissions:[]};
async function login(e){
  e.preventDefault();
  const email=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  const loginMsgEl=document.getElementById('loginMsg');
  try{
    const d=await api('login',{method:'POST',body:JSON.stringify({email,password})});
    await showApp(d.admin.name);
  }catch(x){loginMsgEl.innerHTML='<div class="notice">'+esc(x.message)+'</div>';}
}
async function boot(){try{const s=await api('session');if(s.logged_in)await showApp(s.admin.name);}catch(x){console.warn(x.message)}}
async function showApp(name){document.getElementById('login').classList.add('hidden');document.getElementById('app').classList.remove('hidden');adminName.textContent='Logged in as '+name;await refresh()}
async function logout(){await api('logout');location.reload()}
function tab(id,b){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.side button').forEach(x=>x.classList.remove('active'));b.classList.add('active');}
async function refresh(){const [d,st,t,c,e]=await Promise.all([api('dashboard'),api('admin_students'),api('admin_teachers'),api('admin_classes'),api('admin_exams')]);stats.innerHTML=`<div class="stat"><b>${d.students}</b>Students</div><div class="stat"><b>${d.teachers}</b>Teachers/Staff</div><div class="stat"><b>${d.classes}</b>Classes</div><div class="stat"><b>${d.sections}</b>Sections</div>`;S.students=st.rows;S.teachers=t.rows;S.classes=c.classes;S.sections=c.sections;S.exams=e.rows;renderTables();fillMarkSelects()}
function renderTables(){studentsTable.innerHTML='<tr><th>Roll</th><th>Name</th><th>Class</th><th>Section</th><th>Father</th><th>Action</th></tr>'+S.students.map(x=>`<tr><td>${esc(x.roll||'-')}</td><td>${esc(x.name)}</td><td>${esc(x.class_name||'-')}</td><td>${esc(x.section_name||'-')}</td><td>${esc(x.father||'-')}</td><td><button class="btn small" onclick='studentForm(${JSON.stringify(x)})'>Edit</button> <button class="btn small danger" onclick="delStudent(${x.id})">Delete</button></td></tr>`).join('');teachersTable.innerHTML='<tr><th>Name</th><th>Designation</th><th>Qualification</th><th>Phone</th><th>Action</th></tr>'+S.teachers.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.designation||'-')}</td><td>${esc(x.qualification||'-')}</td><td>${esc(x.phone||'-')}</td><td><button class="btn small" onclick='teacherForm(${JSON.stringify(x)})'>Edit</button> <button class="btn small danger" onclick="delTeacher(${x.id})">Delete</button></td></tr>`).join('');classesTable.innerHTML='<tr><th>Class</th><th>Action</th></tr>'+S.classes.map(x=>`<tr><td>${esc(x.name)}</td><td><button class="btn small" onclick='classForm(${JSON.stringify(x)})'>Edit</button></td></tr>`).join('');sectionsTable.innerHTML='<tr><th>Section</th><th>Class</th><th>Action</th></tr>'+S.sections.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.class_name||'-')}</td><td><button class="btn small" onclick='sectionForm(${JSON.stringify(x)})'>Edit</button></td></tr>`).join('');examsTable.innerHTML='<tr><th>Name</th><th>Year</th><th>Published</th><th>Demo</th><th>Action</th></tr>'+S.exams.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.academic_year)}</td><td>${x.is_published?'Yes':'No'}</td><td>${x.is_demo?'Yes':'No'}</td><td><button class="btn small" onclick='examForm(${JSON.stringify(x)})'>Edit</button></td></tr>`).join('')}
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function filterTable(input,id){const q=input.value.toLowerCase();document.querySelectorAll('#'+id+' tr').forEach((r,i)=>{if(i===0)return;r.style.display=r.innerText.toLowerCase().includes(q)?'':'none'})}
function openModal(title,body){modalTitle.textContent=title;modalBody.innerHTML=body;modal.classList.add('show')};function closeModal(){modal.classList.remove('show')}
function studentForm(x={}){openModal(x.id?'Edit Student':'Add Student',`<form onsubmit="saveStudent(event)"><input type="hidden" id="sid" value="${x.id||''}"><label>Roll No</label><input id="sroll" value="${esc(x.roll||'')}"><label>Student Name</label><input id="sname" required value="${esc(x.name||'')}"><label>Father / Guardian</label><input id="sfather" value="${esc(x.father||'')}"><label>Admission No</label><input id="sadmission" value="${esc(x.admission_no||'')}"><label>Class / Section</label><select id="ssection">${S.sections.map(s=>`<option value="${s.id}" ${String(s.id)===String(x.section_id)?'selected':''}>${esc(s.class_name)} — ${esc(s.name)}</option>`).join('')}</select><button class="btn">Save Student</button></form>`)}
async function saveStudent(e){e.preventDefault();await api('save_student',{method:'POST',body:JSON.stringify({id:sid.value,roll:sroll.value,name:sname.value,father:sfather.value,admission_no:sadmission.value,section_id:ssection.value})});closeModal();refresh()}
async function delStudent(id){if(confirm('Mark this student inactive?')){await api('delete_student',{method:'POST',body:JSON.stringify({id})});refresh()}}
function teacherForm(x={}){openModal(x.id?'Edit Teacher':'Add Teacher',`<form onsubmit="saveTeacher(event)"><input type="hidden" id="tid" value="${x.id||''}"><label>Name</label><input id="tname" required value="${esc(x.name||'')}"><label>Designation</label><input id="tdesignation" value="${esc(x.designation||'')}"><label>Qualification</label><input id="tqualification" value="${esc(x.qualification||'')}"><label>Phone</label><input id="tphone" value="${esc(x.phone||'')}"><label>Email</label><input id="temail" value="${esc(x.email||'')}"><button class="btn">Save Teacher</button></form>`)}
async function saveTeacher(e){e.preventDefault();await api('save_teacher',{method:'POST',body:JSON.stringify({id:tid.value,name:tname.value,designation:tdesignation.value,qualification:tqualification.value,phone:tphone.value,email:temail.value})});closeModal();refresh()}
async function delTeacher(id){if(confirm('Mark this staff member inactive?')){await api('delete_teacher',{method:'POST',body:JSON.stringify({id})});refresh()}}
function classForm(x={}){openModal(x.id?'Edit Class':'Add Class',`<form onsubmit="saveClass(event)"><input type="hidden" id="cid" value="${x.id||''}"><label>Class Name</label><input id="cname" required value="${esc(x.name||'')}"><button class="btn">Save Class</button></form>`)}
async function saveClass(e){e.preventDefault();await api('save_class',{method:'POST',body:JSON.stringify({id:cid.value,name:cname.value})});closeModal();refresh()}
function sectionForm(x={}){openModal(x.id?'Edit Section':'Add Section',`<form onsubmit="saveSection(event)"><input type="hidden" id="secid" value="${x.id||''}"><label>Class</label><select id="secclass">${S.classes.map(c=>`<option value="${c.id}" ${String(c.id)===String(x.class_id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select><label>Section Name</label><input id="secname" required value="${esc(x.name||'')}"><button class="btn">Save Section</button></form>`)}
async function saveSection(e){e.preventDefault();await api('save_section',{method:'POST',body:JSON.stringify({id:secid.value,class_id:secclass.value,name:secname.value})});closeModal();refresh()}
function examForm(x={}){openModal(x.id?'Edit Examination':'Add Examination',`<form onsubmit="saveExam(event)"><input type="hidden" id="eid" value="${x.id||''}"><label>Examination Name</label><input id="ename" required value="${esc(x.name||'')}"><label>Academic Year</label><input id="eyear" required value="${esc(x.academic_year||'2026-27')}"><label><input id="epub" type="checkbox" style="width:auto" ${x.is_published?'checked':''}> Published</label><label><input id="edemo" type="checkbox" style="width:auto" ${x.is_demo?'checked':''}> Demo data</label><br><button class="btn">Save Examination</button></form>`)}
async function saveExam(e){e.preventDefault();await api('save_exam',{method:'POST',body:JSON.stringify({id:eid.value,name:ename.value,academic_year:eyear.value,is_published:epub.checked,is_demo:edemo.checked})});closeModal();refresh()}
function fillMarkSelects(){markExam.innerHTML=S.exams.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.academic_year)}</option>`).join('');markStudent.innerHTML=S.students.map(x=>`<option value="${x.id}">${esc(x.name)} — ${esc(x.roll||'')}</option>`).join('');if(!document.querySelector('#subjectRows .subject-row'))addSubjectRow()}
function addSubjectRow(){const d=document.createElement('div');d.className='subject-row grid2';d.style.marginBottom='4px';d.innerHTML='<div><input class="sub-name" placeholder="Subject name" required></div><div style="display:flex;gap:6px"><input class="sub-total" type="number" min="0" placeholder="Total" required><input class="sub-obt" type="number" min="0" placeholder="Obtained" required><button type="button" class="btn danger small" onclick="this.closest(\'.subject-row\').remove()">×</button></div>';subjectRows.appendChild(d)}
async function saveMarks(e){e.preventDefault();const rows=[...document.querySelectorAll('.subject-row')].map(r=>({name:r.querySelector('.sub-name').value,total:r.querySelector('.sub-total').value,obtained:r.querySelector('.sub-obt').value}));if(!rows.length)return alert('Add at least one subject.');await api('save_result',{method:'POST',body:JSON.stringify({student_id:markStudent.value,exam_id:markExam.value,subjects:rows})});alert('Result saved successfully.');}

async function loadAdmissions(){
  const table=document.getElementById('admissionsTable');
  table.innerHTML='<tr><td>Loading applications...</td></tr>';

  try{
    const d=await api('admin_admissions');
    S.admissions=d.rows||[];

    table.innerHTML=
      '<tr>'+
      '<th>Application No.</th>'+
      '<th>Student</th>'+
      '<th>Father / Guardian</th>'+
      '<th>Class</th>'+
      '<th>Contact</th>'+
      '<th>DOB</th>'+
      '<th>Status</th>'+
      '<th>Submitted</th>'+
      '<th>Action</th>'+
      '</tr>'+
      S.admissions.map(x=>{
        const status=esc(x.status||'Pending');
        return '<tr>'+
          '<td><b>'+esc(x.application_no)+'</b></td>'+
          '<td>'+esc(x.student_name)+'</td>'+
          '<td>'+esc(x.father_name)+'</td>'+
          '<td>'+esc(x.class_name)+'</td>'+
          '<td>'+esc(x.phone)+'</td>'+
          '<td>'+esc(x.dob)+'</td>'+
          '<td>'+status+'</td>'+
          '<td>'+esc(x.created_at||'-')+'</td>'+
          '<td>'+
            '<select onchange="updateAdmissionStatus('+Number(x.id)+',this.value)">'+
              '<option value="Pending" '+(x.status==='Pending'?'selected':'')+'>Pending</option>'+
              '<option value="Approved" '+(x.status==='Approved'?'selected':'')+'>Approved</option>'+
              '<option value="Rejected" '+(x.status==='Rejected'?'selected':'')+'>Rejected</option>'+
            '</select>'+
          '</td>'+
        '</tr>';
      }).join('');

    if(!S.admissions.length){
      table.innerHTML='<tr><td colspan="9">No admission applications have been submitted yet.</td></tr>';
    }
  }catch(e){
    table.innerHTML='<tr><td colspan="9"><div class="notice">'+esc(e.message)+'</div></td></tr>';
  }
}

async function updateAdmissionStatus(id,status){
  try{
    await api('update_admission_status',{
      method:'POST',
      body:JSON.stringify({id,status})
    });
    await loadAdmissions();
  }catch(e){
    alert(e.message);
    await loadAdmissions();
  }
}

async function printWholeSchoolResult() {
  const w = window.open('', '_blank');

  if (!w) {
    alert('Please allow pop-ups for this website.');
    return;
  }

  try {
    const d = await api('whole_school_report');

    const rows = (d.rows || []).map(x => `
      <tr>
        <td>${esc(x.roll || '-')}</td>
        <td>${esc(x.student_name)}</td>
        <td>${esc(x.class_name)}</td>
        <td>${x.total_marks}</td>
        <td>${x.obtained_marks}</td>
        <td>${x.percentage}%</td>
      </tr>
    `).join('');

    w.document.write(`
      <html>
      <head>
        <title>Whole School Result</title>
        <style>
          body {
            font-family: Arial;
            padding: 25px;
          }

          h1, h2 {
            text-align: center;
          }

          .table {
            width: 100%;
            border-collapse: collapse;
          }

          .table th,
          .table td {
            border: 1px solid #888;
            padding: 7px;
          }

          .table th {
            background: #eee;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        </style>
      </head>

      <body>
        <h1>Govt. Muslim Girls A.V. High School Jhelum</h1>
        <h2>Whole School Result</h2>

        <table class="table">
          <tr>
            <th>Roll No</th>
            <th>Student Name</th>
            <th>Class</th>
            <th>Total Marks</th>
            <th>Obtained Marks</th>
            <th>Percentage</th>
          </tr>

          ${rows}
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
      </html>
    `);

    w.document.close();

  } catch (e) {
    w.close();
    alert(e.message);
  }
}

boot();