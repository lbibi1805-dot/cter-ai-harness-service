import { markdownToDocx } from './src/utils/markdownToDocx';

const input = `Permissions: If the target denies execution permissions, change them by running the command:
$$\\text{chmod 755 /tmp/Executable_Name}$$
4. Execute: Navigate to the folder and execute the file on the target terminal: cd /tmp
$$\\text{./Executable_Name}$$`;

async function main() {
  const buf = await markdownToDocx('Test Render', {}, input);
  const { writeFileSync } = await import('fs');
  writeFileSync('test_render.docx', buf);
  console.log('Wrote test_render.docx');
}

main().catch(console.error);
