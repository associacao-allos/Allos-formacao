const l = require('./lib');
(async () => {
  const svc = await l.services();
  for (const n of process.argv.slice(2)) {
    if (!n.startsWith('sb-')) throw new Error('só serviços sb-*');
    const d = await l.gql(`mutation($s:String!,$e:String!){ serviceInstanceDeployV2(serviceId:$s, environmentId:$e) }`, { s: svc[n], e: l.ENV });
    console.log('deploy', n, d.serviceInstanceDeployV2);
  }
})().catch(e => console.error(e.message));
