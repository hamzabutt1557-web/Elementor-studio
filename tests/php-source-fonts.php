<?php
define('ABSPATH','/');function add_action($a,$b){}function add_filter($a,$b){}
require __DIR__.'/../wordpress/elementor-studio-importer.php';
$f=array('family'=>'Jost*','url'=>'https://example.com/book.woff2','weight'=>'400','style'=>'normal');
if(estudio_clean_source_fonts(array($f))[0]!==$f)throw new Exception('Font changed');
foreach(array('javascript:alert(1)','https://example.com/a");body{}','https://example.com/a b') as $url){$bad=$f;$bad['url']=$url;$failed=false;try{estudio_clean_source_fonts(array($bad));}catch(Throwable $e){$failed=true;}if(!$failed)throw new Exception('Unsafe font accepted');}
echo "Source fonts passed\n";
