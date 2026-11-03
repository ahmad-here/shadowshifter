// Runs tools/blender/fire.py in headless Blender and writes public/models/fire.glb.
// Uses BLENDER=<path to blender.exe> if set, else `blender` on PATH (or the default Windows install).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const win = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const blender = process.env.BLENDER ?? (existsSync(win) ? win : 'blender');
for (const script of ['fire.py', 'obstacles.py']) {
  const out = execFileSync(
    blender,
    ['-b', '--factory-startup', '--python', `tools/blender/${script}`],
    { encoding: 'utf8' },
  );
  console.log(out.split('\n').find((l) => /^(FIRE|OBSTACLES)/.test(l)) ?? out);
}
