// LOCAL ONLY: container fixo supabase_db_MercurioCapital; não usa URL/credenciais remotas.
// Cria fixtures sintéticas com UUIDs aleatórios, testa sessões concorrentes e as remove em finally.
// Requer Docker local já iniciado e migrations até 20261118000002. Sem dependências adicionais.
import { spawn, execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
const user=randomUUID(), partner=randomUUID(), prospect=randomUUID()
const dbargs=['exec','-i','supabase_db_MercurioCapital','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
function sql(source){return execFileSync('docker',dbargs,{input:source,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
const claims=JSON.stringify({sub:user,role:'authenticated',aal:'aal2',app_metadata:{role:'partner',approved:true,partner_id:partner}})
const auth=`set local role authenticated; set local request.jwt.claims='${claims}';`
async function concurrent(first, second) {
 const child=spawn('docker',dbargs,{stdio:['pipe','pipe','pipe']}); let stdout='',stderr=''
 let ready; const waitReady=new Promise(resolve=>ready=resolve)
 child.stdout.on('data',data=>{stdout+=data; if(stdout.includes('race_ready'))ready()}); child.stderr.on('data',data=>stderr+=data)
 const done=new Promise(resolve=>child.on('close',code=>resolve({code,stdout,stderr})))
 child.stdin.end(`begin; ${auth} ${first} select 'race_ready'; select pg_sleep(1.2); commit;`)
 await Promise.race([waitReady,new Promise((_,reject)=>setTimeout(()=>reject(Error('Lock not acquired')),5000))])
 const started=Date.now(); let result,failed=false
 try { result=sql(`begin; ${auth} ${second} commit;`) } catch(error){result=error.stderr.toString();failed=true}
 const elapsed=Date.now()-started,firstResult=await done
 assert.equal(firstResult.code,0,firstResult.stderr)
 assert.ok(elapsed>=700,'Operação concorrente não aguardou o bloqueio')
 return {result,failed,elapsed}
}
try {
 sql(`begin; insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data) values('${user}','authenticated','authenticated','f66-race-${user}@test.invalid',now(),now(),now(),'{"nome_completo":"Teste concorrência F66"}'); update public.usuarios set role='partner' where id='${user}'; insert into public.partners(id,usuario_id,status) values('${partner}','${user}','approved'); insert into public.prospeccoes_clientes(id,partner_id,responsavel_id,nome_completo,email,created_by,updated_by) values('${prospect}','${partner}','${user}','Teste concorrência F66','race@test.invalid','${user}','${user}'); commit;`)
 const reservation=JSON.parse(sql(`begin; ${auth} select row_to_json(r) from public.prospeccao_cliente_anexo_preparar('${prospect}','race.png','image/png',100)r; commit;`))
 const upload=await concurrent(`insert into storage.objects(bucket_id,name,metadata) values('prospeccao-clientes-anexos','${reservation.storage_path}','{"size":100,"mimetype":"image/png"}');`, `select public.prospeccao_cliente_anexo_cancelar('${reservation.anexo_id}');`)
 assert.ok(upload.failed && upload.result.includes('remova_objeto_pendente'),upload.result)
 console.log('PASS upload simultâneo com cancelamento: aguardou bloqueio e preservou objeto/reserva')
 const confirm=await concurrent(`select public.prospeccao_cliente_anexo_confirmar('${reservation.anexo_id}');`, `select set_config('storage.allow_delete_query','true',true); with removed as(delete from storage.objects where bucket_id='prospeccao-clientes-anexos' and name='${reservation.storage_path}' returning id) select 'removed='||count(*) from removed;`)
 assert.ok(!confirm.failed && confirm.result.includes('removed=0'),confirm.result)
 console.log('PASS confirmação simultânea com remoção: recebeu evidência e bloqueou delete')
 sql(`begin; ${auth} select * from public.prospeccao_cliente_anexo_preparar('${prospect}','second.png','image/png',100); commit;`)
 const quota=await concurrent(`select * from public.prospeccao_cliente_anexo_preparar('${prospect}','third.png','image/png',100);`, `select * from public.prospeccao_cliente_anexo_preparar('${prospect}','fourth.png','image/png',100);`)
 assert.ok(quota.failed && quota.result.includes('maximo_3_anexos'),quota.result)
 assert.equal(sql(`select count(*) from public.prospeccoes_clientes_anexos where prospeccao_id='${prospect}' and deleted_at is null`),'3')
 console.log('PASS reservas concorrentes: limite final de 3 preservado')
} finally {
 sql(`begin; select set_config('storage.allow_delete_query','true',true); delete from storage.objects where bucket_id='prospeccao-clientes-anexos' and name like '${prospect}/%'; delete from public.prospeccoes_clientes_anexos where prospeccao_id='${prospect}'; delete from public.prospeccoes_clientes where id='${prospect}'; delete from public.partner_wallets where partner_id='${partner}'; delete from public.partners where id='${partner}'; delete from public.audit_log where usuario_id='${user}'; delete from auth.users where id='${user}' and email='f66-race-${user}@test.invalid'; commit;`)
 console.log('Fixtures locais F66 removidas')
}
