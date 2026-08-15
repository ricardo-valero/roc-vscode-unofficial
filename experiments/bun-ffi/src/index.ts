import { dlopen, FFIType, suffix } from 'bun:ffi';
import path from 'path';

const libpath = path.resolve(`./libinterop.${suffix}`);

const lib = dlopen(libpath, {
  add: {
    args: [FFIType.i32, FFIType.i32],
    returns: FFIType.i32,
  },
});

console.log(lib.symbols.add(34, 52));

//   lib.symbols.main(
//     new CString(ptr(new TextEncoder().encode('Hello from Bun!'))),
//   ),
