import {chromium} from '/tmp/nsoc-atelier3425/frontend/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.argv[2];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const reports=[];
const tasks=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('tasks')||'[]'));
const waitText=(p,text)=>p.locator('.task-title').filter({hasText:text}).waitFor();
try {
 for(const [mode,port] of [['development',4296],['production',4297]]){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const a=await context.newPage(),b=await context.newPage();const errors=[];
  for(const p of [a,b]){p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+port);}
  for(const [p,text] of [[a,'Alpha'],[b,'Beta']])await p.getByRole('textbox',{name:'New task title',exact:true}).fill(text);
  await Promise.all([a.getByRole('button',{name:'Add task',exact:true}).click(),b.getByRole('button',{name:'Add task',exact:true}).click()]);
  for(const p of [a,b]){await waitText(p,'Alpha');await waitText(p,'Beta');}
  assert.equal((await tasks(a)).length,2);
  await a.getByRole('button',{name:'Edit task Alpha',exact:true}).click();
  await a.locator('.edit-input').fill('Alpha edited');
  await a.locator('.edit-input').press('Enter');
  await waitText(b,'Alpha edited');
  await b.getByRole('button',{name:'Move Beta up',exact:true}).click();
  await a.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks'))[0].text==='Beta');
  const arr=await tasks(a);assert.equal(arr[1].text,'Alpha edited');
  await b.getByRole('button',{name:'Delete task Beta',exact:true}).click();
  await a.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).length===1);
  await a.waitForFunction(()=>document.querySelectorAll('.task-title').length===1);
  await b.getByRole('button',{name:/Undo/}).first().click();
  await waitText(a,'Beta');
  const alpha=a.locator('li').filter({has:a.getByRole('button',{name:'Delete task Alpha edited',exact:true})});
  await alpha.locator('.done-button').click();
  await b.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.text==='Alpha edited').completed);
  const before=await tasks(b);
  await b.screenshot({path:out+'/task51-'+mode+'-populated.png',fullPage:true});
  await a.evaluate(()=>localStorage.setItem('theme','light'));
  await b.waitForTimeout(80);assert.deepEqual(await tasks(b),before);
  await a.evaluate(()=>localStorage.setItem('tasks','broken'));
  await b.getByRole('alert').filter({hasText:'could not be read'}).waitFor();
  assert.equal(await b.locator('.task-title').count(),1);
  assert.equal(await b.evaluate(()=>localStorage.getItem('tasks')),'broken');
  await a.evaluate(data=>localStorage.setItem('tasks',JSON.stringify(data)),before);
  await b.waitForFunction(()=>!Array.from(document.querySelectorAll('[role=alert]')).some(x=>x.textContent.includes('could not be read')));
  await a.evaluate(()=>localStorage.removeItem('tasks'));
  await b.waitForFunction(()=>document.querySelectorAll('.task-title').length===0);
  await b.reload();await b.waitForTimeout(80);
  assert.equal(await b.evaluate(()=>localStorage.getItem('tasks')),null);
  assert.deepEqual(errors,[]);
  await a.screenshot({path:out+'/task51-'+mode+'.png',fullPage:true});
  await context.close();
  const fallback=await browser.newContext();
  await fallback.addInitScript(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
  const p=await fallback.newPage();await p.goto('http://127.0.0.1:'+port);
  await p.getByRole('alert').filter({hasText:'read-only'}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Add task',exact:true}).isDisabled(),true);
  await fallback.close();
  reports.push({mode,twoTabs:true,concurrentAdds:2,edit:true,reorder:true,delete:true,undo:true,completion:true,unrelatedThemeIgnored:true,corruptStoragePreserved:true,removeDoesNotResurrect:true,unsupportedLockReadOnly:true});
 }
}finally{await browser.close();}
await fs.writeFile(out+'/task51-browser.json',JSON.stringify(reports,null,2)+'\n');console.log(reports);
