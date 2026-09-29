import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';

type Accessor = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
};
type BufferView = { byteOffset?: number; byteStride?: number };
type Gltf = {
  accessors: Accessor[];
  bufferViews: BufferView[];
  meshes: { primitives: { indices: number; attributes: Record<string, number> }[] }[];
};

const root = resolve(import.meta.dir, '..');
const source = await Bun.file(resolve(root, 'packages/assets/models/duck.glb')).arrayBuffer();
const data = new DataView(source);
const jsonLength = data.getUint32(12, true);
const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(source, 20, jsonLength))) as Gltf;
const binaryStart = 28 + jsonLength;
const primitive = gltf.meshes[0]!.primitives[0]!;

function attribute(id: number): Float32Array {
  const accessor = gltf.accessors[id]!;
  const view = gltf.bufferViews[accessor.bufferView]!;
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  if (!width) throw new Error(`Unsupported attribute ${accessor.type}.`);
  const bytes = accessor.componentType === 5126 ? 4 : 2;
  const stride = view.byteStride ?? width * bytes;
  const offset = binaryStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = new Float32Array(accessor.count * width);
  for (let vertex = 0; vertex < accessor.count; vertex++) {
    for (let component = 0; component < width; component++) {
      const address = offset + vertex * stride + component * bytes;
      values[vertex * width + component] =
        accessor.componentType === 5126 ? data.getFloat32(address, true) : data.getUint16(address, true);
    }
  }
  return values;
}

const positions = attribute(primitive.attributes.POSITION!);
const normals = attribute(primitive.attributes.NORMAL!);
const uvs = attribute(primitive.attributes.TEXCOORD_0!);
const indices = new Uint32Array(attribute(primitive.indices));
const vertexCount = positions.length / 3;
const attributes = new Float32Array(vertexCount * 5);
const locks = new Uint8Array(vertexCount);
for (let vertex = 0; vertex < vertexCount; vertex++) {
  attributes.set(uvs.subarray(vertex * 2, vertex * 2 + 2), vertex * 5);
  attributes.set(normals.subarray(vertex * 3, vertex * 3 + 3), vertex * 5 + 2);
  const u = uvs[vertex * 2]!;
  const v = uvs[vertex * 2 + 1]!;
  if (u > 0.61 && v < 0.47) locks[vertex] = 1;
}

await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
const levels: Record<string, { indices: number[]; triangles: number; relativeError: number }> = {};
for (const [name, target, error] of [
  ['medium', 1600, 0.006],
  ['low', 760, 0.012],
] as const) {
  const [reduced, actualError] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    attributes,
    5,
    [0.6, 0.6, 0.05, 0.05, 0.05],
    locks,
    target * 3,
    error,
    ['LockBorder'],
  );
  if (reduced.some((index) => index >= vertexCount))
    throw new Error('The reduced mesh has an invalid index.');
  levels[name] = { indices: Array.from(reduced), triangles: reduced.length / 3, relativeError: actualError };
}

const output = {
  version: 1,
  source: 'duck.glb',
  sha256: createHash('sha256').update(new Uint8Array(source)).digest('hex'),
  vertices: vertexCount,
  sourceTriangles: indices.length / 3,
  method:
    'meshoptimizer simplifyWithAttributes, locked borders and eye vertices, original vertex attributes retained',
  levels,
};
await Bun.write(resolve(root, 'packages/assets/models/duck-lods.json'), JSON.stringify(output));
console.log(
  JSON.stringify(
    {
      sourceTriangles: output.sourceTriangles,
      levels: Object.fromEntries(
        Object.entries(levels).map(([name, value]) => [
          name,
          { triangles: value.triangles, relativeError: value.relativeError },
        ]),
      ),
    },
    null,
    2,
  ),
);
