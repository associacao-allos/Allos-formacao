const l = require('./lib');
(async () => {
  const svc = await l.services();
  const name = process.argv[2], n = +(process.argv[3] || 40);
  const d = await l.gql(`query($s:String!,$e:String!){ serviceInstance(serviceId:$s, environmentId:$e){ latestDeployment{ id } } }`, { s: svc[name], e: l.ENV });
  const id = d.serviceInstance.latestDeployment.id;
  const r = await l.gql(`query($id:String!,$n:Int){ deploymentLogs(deploymentId:$id, limit:$n){ timestamp message severity } }`, { id, n });
  for (const x of r.deploymentLogs) console.log(x.timestamp.slice(11, 19), (x.message || '').slice(0, 400));
})().catch(e => console.error(e.message));
