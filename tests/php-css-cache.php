<?php
namespace Elementor {
  class Plugin { public static $instance; }
}
namespace {
  define('ABSPATH', '/');
  function add_action($a, $b) {}
  function add_filter($a, $b) {}
  function do_action($name, ...$args) { $GLOBALS['estudio_actions'][] = array($name, $args); }
  require __DIR__ . '/../wordpress/elementor-studio-importer.php';
  $manager = new class { public $clears = 0; public function clear_cache() { $this->clears++; } };
  \Elementor\Plugin::$instance = (object)array('files_manager' => $manager);
  estudio_refresh_page_css(123);
  if ($manager->clears !== 1) throw new \Exception('Imported Elementor CSS cache was not cleared.');
  if (($GLOBALS['estudio_actions'][0][0] ?? '') !== 'elementor/core/files/clear_cache') throw new \Exception('Elementor cache hook was not notified.');
  if (($GLOBALS['estudio_actions'][0][1][0] ?? 0) !== 123) throw new \Exception('Imported page id was not passed to the cache hook.');
  echo "Elementor CSS cache refresh checks passed\n";
}
