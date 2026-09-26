const l = require('./lib');
(async () => {
  const have = await l.services();
  for (const name of ['sb-auth', 'sb-rest', 'sb-storage', 'sb-gateway']) {
    let id = have[name];
    if (!id) {
      const d = await l.gql(`mutation($i:ServiceCreateInput!){ serviceCreate(input:$i){ id name } }`, { i: { projectId: l.PROJECT, environmentId: l.ENV, name } });
      id = d.serviceCreate.id;
      console.log('criado', name, id);
    } else console.log('já existe', name, id);
    await l.gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`,
      { s: id, e: l.ENV, i: { multiRegionConfig: { [l.REGION]: { numReplicas: 1 } }, restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 10 } });
  }
})().catch(e => { console.error(e.message); process.exit(1); });
