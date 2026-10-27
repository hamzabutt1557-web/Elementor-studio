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
 'css_classes'=>'estudio-tools estudio-node unsafe-class',
 'studio_display'=>'flow-root','studio_float'=>'left','studio_float_mobile'=>'none',
 'studio_position'=>'relative','studio_position_tablet'=>'fixed','studio_position_mobile'=>'expression(evil)','studio_left_tablet'=>'-400px','studio_top_tablet'=>'url(evil)',
 'studio_height'=>'140px','studio_height_mobile'=>'auto','studio_aspect_ratio'=>'0.6666667','studio_aspect_ratio_mobile'=>'auto','studio_object_position'=>'50% 20%',
 'studio_height_tablet'=>'expression(evil)','studio_aspect_ratio_tablet'=>'0','studio_object_position_mobile'=>'url(evil)',
 'studio_clear_mobile'=>'both','studio_vertical_align'=>'middle',
 'studio_flex_shrink'=>array('unit'=>'px','size'=>0),
 'studio_display_tablet'=>'url(evil)','studio_clear_tablet'=>'invalid',

),'elements'=>array()));
$clean=estudio_clean_elements($input,0,$count)[0]['settings'];
if($clean['width']['unit']!=='custom'||$clean['width']['size']!=='min(80%, 960px)')throw new Exception('Native bounded width lost');
if($clean['background_image_tablet']['url']!==''||$clean['position_tablet']!==''||$clean['border_border_tablet']!=='none')throw new Exception('Responsive resets lost');
if($clean['css_classes']!=='estudio-tools estudio-node')throw new Exception('Optional product marker or class allowlist failed');
if($clean['studio_display']!=='flow-root'||$clean['studio_float_mobile']!=='none'||$clean['studio_clear_mobile']!=='both'||$clean['studio_vertical_align']!=='middle')throw new Exception('Source flow controls lost');
if(isset($clean['studio_display_tablet'])||isset($clean['studio_clear_tablet']))throw new Exception('Invalid CSS control accepted');
if($clean['studio_height']!=='140px'||$clean['studio_height_mobile']!=='auto'||$clean['studio_aspect_ratio']!=='0.6666667'||$clean['studio_aspect_ratio_mobile']!=='auto'||$clean['studio_object_position']!=='50% 20%')throw new Exception('Responsive image sizing controls lost');
if(isset($clean['studio_height_tablet'])||isset($clean['studio_aspect_ratio_tablet'])||isset($clean['studio_object_position_mobile']))throw new Exception('Invalid sizing CSS accepted');
if($clean['studio_position']!=='relative'||$clean['studio_position_tablet']!=='fixed'||$clean['studio_left_tablet']!=='-400px')throw new Exception('Responsive positions lost');
if(isset($clean['studio_position_mobile'])||isset($clean['studio_top_tablet']))throw new Exception('Invalid position CSS accepted');
echo "PHP native layout settings checks passed\n";
