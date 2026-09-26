const l = require('./lib');
(async () => {
  const svc = await l.services();
  for (const n of ['sb-auth', 'sb-rest', 'sb-storage', 'sb-gateway', 'Allos-formacao']) {
    const d = await l.gql(`query($s:String!,$e:String!){ serviceInstance(serviceId:$s, environmentId:$e){ latestDeployment{ id status createdAt } } }`, { s: svc[n], e: l.ENV });
    console.log(n.padEnd(15), JSON.stringify(d.serviceInstance.latestDeployment));
  }
})();
