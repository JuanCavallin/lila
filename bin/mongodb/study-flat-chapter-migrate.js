const coll = db.study_chapter_flat;
coll.drop();
coll.createIndex({studyId:1,order:1})

function flattenEach(parentPath, node, nodes) {
  const path = parentPath + encodePath(node.i || '');
  if (path.length > 400 * 2) throw 'Too deep!';
  if (node.n.length > 1) node.o = node.n.map(child => child.i);
  node.n.forEach(child => flattenEach(path, child, nodes));
  delete node.n;
  delete node.i;
  nodes[path] = node;
}

const dotRegex = /\./g;
const dollarRegex = /\$/g;

function encodePath(path) {
  return path ? path
    .replace(dotRegex, String.fromCharCode(144))
    .replace(dollarRegex, String.fromCharCode(145)) : '_';
}

let i = 0;
let lastAt = Date.now();
let sumSizeFrom = 0;
let sumSizeTo = 0;
let sumMoves = 0;
let tooBigNb = 0;
let tooDeepNb = 0;
let batch = [];

const batchSize = 1000;
const totalNb = db.study_chapter_backup.count();

db.study_chapter_backup.find().forEach(c => {
  try {
    sumSizeFrom += Object.bsonsize(c);
  } catch (e) {
    tooDeepNb++;
  }
  const tree = {};
  try {
    flattenEach('', c.root, tree);
  } catch (e) {
    print(`ERROR ${c._id} ${e}`);
    return;
  }
  c.root = tree;
  sumSizeTo += Object.bsonsize(c);
  const nbMoves = Object.keys(c.root).length;
  if (nbMoves > 3000) tooBigNb++;
  else batch.push(c);
  i++;
  sumMoves += nbMoves;
  if (i % batchSize == 0) {
    coll.insertMany(batch, {
      ordered: false,
      writeConcern: { w: 0, j: false }
    });
    batch = [];
    const at = Date.now();
    const perSecond = Math.round(batchSize / (at - lastAt) * 1000);
    const percent = 100 * i / totalNb;
    const minutesLeft = Math.round((totalNb - i) / perSecond / 60);
    print(`${i} ${percent.toFixed(2)}% ${perSecond}/s ETA ${minutesLeft} minutes | size:${(sumSizeFrom / batchSize).toFixed(0)}->${(sumSizeTo / batchSize).toFixed(0)} moves:${(sumMoves / batchSize).toFixed(0)} big:${tooBigNb} deep:${tooDeepNb}`);
    lastAt = at;
    sumSizeFrom = 0;
    sumSizeTo = 0;
    sumMoves = 0;
    tooBigNb = 0;
    tooDeepNb = 0;
  }
});
