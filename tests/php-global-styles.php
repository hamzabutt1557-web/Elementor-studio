<?php
// Run: php tests/php-global-styles.php
// Isolated PHP logic regression; these stubs do not constitute WordPress integration.
define('ABSPATH', '/');
function add_action($a, $b) {}
function add_filter($a, $b) {}
function wp_json_encode($v) { return json_encode($v); }
require __DIR__.'/../wordpress/elementor-studio-importer.php';
$pages=array(array('elements'=>array(array('settings'=>array('title_color'=>'#112233','typography_font_family'=>'Arial','typography_font_size'=>array('unit'=>'px','size'=>24),'typography_font_weight'=>'700'), 'elements'=>array()))));
$old=array('custom_colors'=>array(array('_id'=>'keep','title'=>'Existing','color'=>'#abcdef')),'custom_typography'=>array());
$next=estudio_global_styles($pages,$old);
if(count($next['custom_colors'])!==2 || $next['custom_colors'][0]['_id']!=='keep')throw new Exception('Existing colours changed');
if(count($next['custom_typography'])!==1)throw new Exception('Typography missing');
$settings=$pages[0]['elements'][0]['settings'];
if(strpos($settings['__globals__']['title_color'],'globals/colors?id=')!==0)throw new Exception('Global colour missing');
if(strpos($settings['__globals__']['typography_typography'],'globals/typography?id=')!==0)throw new Exception('Global font missing');
if(isset($settings['title_color'])||isset($settings['typography_font_family']))throw new Exception('Local style overrides global');
$again=estudio_global_styles($pages,$next);
if(count($again['custom_colors'])!==2 || count($again['custom_typography'])!==1)throw new Exception('Repeated import duplicates');
echo "PHP importer regression checks passed\n";
