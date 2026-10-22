<?php
// Isolated PHP logic and URL safety checks; not a WordPress editor acceptance test.
define('ABSPATH','/');
function add_action($a,$b) {}
function add_filter($a,$b) {}
require __DIR__.'/../wordpress/elementor-studio-importer.php';
$font=array('family'=>'Noto Nastaliq Urdu','weights'=>array(700,400,400),'italicWeights'=>array());
$clean=estudio_clean_fonts(array($font));
if($clean[0]['weights']!==array(400,700))throw new Exception('Weights not normalized');
if(estudio_font_url($font)!=='https://fonts.googleapis.com/css2?family=Noto%20Nastaliq%20Urdu:wght@400;700&display=swap')throw new Exception('Wrong Google CSS URL');
$font['italicWeights']=array(400,700);
if(strpos(estudio_font_url($font),':ital,wght@0,400;0,700;1,400;1,700')===false)throw new Exception('Italic styles lost');
if (strpos(estudio_font_url(array('family'=>'Molle','weights'=>array(),'italicWeights'=>array(400))), ':ital,wght@1,400')===false)throw new Exception('Italic-only font failed');
foreach(array(array('family'=>'Bad; } body {','weights'=>array(400)),array('family'=>'https://evil.test/font','weights'=>array(400)),array('family'=>'Inter','weights'=>array(9999))) as $bad){$failed=false;try{estudio_clean_fonts(array($bad));}catch(Throwable $e){$failed=true;}if(!$failed)throw new Exception('Unsafe font accepted');}
echo "PHP font manifest checks passed\n";
