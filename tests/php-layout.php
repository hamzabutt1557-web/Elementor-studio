<?php
// Importer data contract only; this does not execute Elementor's frontend CSS engine.
define('ABSPATH','/');
function add_action($a,$b) {}
function add_filter($a,$b) {}
function sanitize_text_field($s) {return strip_tags($s);}
function esc_url_raw($s,$allowed) {return $s;}
require __DIR__.'/../wordpress/elementor-studio-importer.php';
$count=0;
$input=array(array('id'=>'abc12345','elType'=>'container','settings'=>array(
 'width'=>array('unit'=>'custom','size'=>'min(80%, 960px)','sizes'=>array()),
 'background_image_tablet'=>array('id'=>'','url'=>''),'position_tablet'=>'','border_border_tablet'=>'none',
 'css_classes'=>'estudio-tools unsafe-class',
),'elements'=>array()));
$clean=estudio_clean_elements($input,0,$count)[0]['settings'];
if($clean['width']['unit']!=='custom'||$clean['width']['size']!=='min(80%, 960px)')throw new Exception('Native bounded width lost');
if($clean['background_image_tablet']['url']!==''||$clean['position_tablet']!==''||$clean['border_border_tablet']!=='none')throw new Exception('Responsive resets lost');
if($clean['css_classes']!=='estudio-tools')throw new Exception('Optional product marker or class allowlist failed');
echo "PHP native layout settings checks passed\n";
