export function authorUnitCube(engine) {
  const project=engine.n.authoringProject;
  const receipt=project.execute({requestId:'soundstage:cube:v1',epoch:project.context().epoch,operations:[{id:'mesh.cube',args:{id:'soundstage-unit',size:1}}]});
  const doc=project.getDocument('soundstage-unit');
  if(!doc?.content?.vertices || !doc.content.faces) throw new Error('Authoring returned no cube geometry');
  const vertices=new Map(doc.content.vertices.map(v=>[v.id,v.position]));
  const positions=[];
  for(const face of doc.content.faces) for(let i=1;i<face.vertices.length-1;i++) for(const id of [face.vertices[0],face.vertices[i],face.vertices[i+1]]) {
    const v=vertices.get(id);if(!v||v.length!==3||!v.every(Number.isFinite))throw new Error('Invalid authored vertex');positions.push(...v);
  }
  return {positions,receipt,snapshot:project.getSnapshot()};
}
