import {readFileSync,writeFileSync} from 'node:fs';
import {interactionCss,interactionScript} from '../lib/interactions';
let php=readFileSync('wordpress/elementor-studio-importer.php','utf8');
php=php.replace(/<<<'ESTUDIOCSS'\n[\s\S]*?\nESTUDIOCSS/,"<<<'ESTUDIOCSS'\n"+interactionCss+'\nESTUDIOCSS');
php=php.replace(/<<<'ESTUDIOJS'\n[\s\S]*?\nESTUDIOJS/,"<<<'ESTUDIOJS'\n"+interactionScript+'\nESTUDIOJS');
writeFileSync('wordpress/elementor-studio-importer.php',php);
writeFileSync('lib/importer.ts','// Generated from wordpress/elementor-studio-importer.php by scripts/sync-importer.ts.\nexport const importerPhp = '+JSON.stringify(php)+';\n');
