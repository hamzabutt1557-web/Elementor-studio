<?php
/**
 * Plugin Name: Elementor Studio Importer
 * Description: Import an Elementor Studio ZIP as editable draft WordPress pages with packaged media.
 * Version: 0.4.10
 * Requires PHP: 7.4
 */
if (!defined('ABSPATH')) exit;
add_action('admin_menu', function () {
  add_management_page('Elementor Studio', 'Elementor Studio', 'manage_options', 'elementor-studio', 'estudio_screen');
});
function estudio_clean_elements($elements, $depth = 0, &$count = 0) {
  if (!is_array($elements) || $depth > 24) throw new Exception('Invalid template structure.');
  $out = array();
  foreach ($elements as $e) {
    if (++$count > 3000 || !is_array($e) || !preg_match('/^[a-f0-9]{7,8}$/', $e['id'] ?? '')) throw new Exception('Invalid template element.');
    $kind = $e['elType'] ?? '';
    if (!in_array($kind, array('container','widget'), true)) throw new Exception('Unsupported element.');
    if ($kind === 'widget' && !in_array($e['widgetType'] ?? '', array('heading','text-editor','button','image','video'), true)) throw new Exception('Unsupported widget.');
    $settings = array();
    foreach (($e['settings'] ?? array()) as $key => $value) {
      if (!preg_match('/^(hide_desktop|hide_tablet|hide_mobile|video_type|hosted_url|youtube_url|vimeo_url|controls|container_type|css_classes|_css_classes|position|_position|_offset_x|_offset_y|z_index|_z_index|overflow|height|grid_column|_grid_column|grid_columns_grid|grid_rows_grid|grid_gaps|_padding|_margin|_border_radius|border_border|border_width|border_color|_border_border|_border_width|_border_color|_background_(background|color|image|position|xpos|ypos|size|bg_width|repeat)|html_tag|link_to|title|header_size|editor|text|link|image|image_size|caption_source|content_width|width|min_height|padding|margin|border_radius|background_(background|color|image|position|xpos|ypos|size|bg_width|repeat)|title_color|button_text_color|text_color|align|typography_(typography|font_size|font_family|font_weight|line_height|letter_spacing|text_transform)|flex_(direction|gap|justify_content|align_items|wrap)|_element_(width|custom_width)|object-fit)(_tablet|_mobile)?$/', $key)) continue;
      if ($key === 'css_classes' || $key === '_css_classes') {
        $value = implode(' ', array_filter(explode(' ', (string)$value), function($v) { return preg_match('/^estudio-(panel|product|disclosure|tools|(?:panel|toggle|close)-[a-f0-9]{7,8})$/', $v); }));
      } elseif ($key === 'editor') $value = wp_kses_post((string)$value);
      elseif ($key === 'title') $value = wp_kses((string)$value, array('strong'=>array(),'em'=>array(),'u'=>array(),'br'=>array(),'a'=>array('href'=>array()),'span'=>array('style'=>array())));
      elseif ($key === 'text') $value = sanitize_text_field((string)$value);
      elseif (is_string($value)) $value = sanitize_text_field($value);
      elseif (is_array($value)) {
        foreach ($value as $k => $v) {
          if (is_array($v) || is_object($v)) { unset($value[$k]); continue; }
          $value[$k] = $k === 'url' ? esc_url_raw((string)$v, array('http','https')) : sanitize_text_field((string)$v);
        }
      } elseif (is_numeric($value)) $value = (float)$value;
      else continue;
      $settings[$key] = $value;
    }
    $out[] = array('id'=>$e['id'], 'elType'=>$kind, 'isInner'=>!empty($e['isInner']), 'widgetType'=>$e['widgetType'] ?? null, 'settings'=>$settings, 'elements'=>estudio_clean_elements($e['elements'] ?? array(), $depth+1, $count));
  }
  return $out;
}
function estudio_remap(&$elements, $media) {
  foreach ($elements as &$e) {
    foreach ($e['settings'] as $key => &$value) {
      if (is_array($value) && !empty($value['url']) && isset($media[$value['url']])) {
        $value = array_merge($value, $media[$value['url']]);
      }
    }
    unset($value);
    estudio_remap($e['elements'], $media);
  }
}
// Elementor caches generated CSS per page. Clear that cache after the imported
// page data is saved so the first frontend/editor load compiles the new styles.
function estudio_refresh_page_css($post_id) {
  if (!class_exists('\\Elementor\\Plugin')) return;
  $pluginClass = 'Elementor\\Plugin';
  $plugin = $pluginClass::$instance;
  if (is_object($plugin) && isset($plugin->files_manager) && method_exists($plugin->files_manager, 'clear_cache')) {
    $plugin->files_manager->clear_cache();
  }
  // Keep the page id available for integrations that hook Elementor's cache reset.
  do_action('elementor/core/files/clear_cache', (int)$post_id);
}
// Optional native global styles: append custom entries; never replace existing site colours/fonts.
function estudio_global_styles(&$pages, $kit_settings) {
  $colors = $kit_settings['custom_colors'] ?? array();
  $fonts = $kit_settings['custom_typography'] ?? array();
  $walk = function (&$elements) use (&$walk, &$colors, &$fonts) {
    foreach ($elements as &$e) {
      $s =& $e['settings'];
      foreach (array('title_color','text_color','button_text_color','background_color','_background_color','border_color','_border_color') as $key) {
        $value = $s[$key] ?? null;
        if (!is_string($value) || !preg_match('/^(#[a-f0-9]{3,8}|rgba?\([0-9.,% ]+\))$/i', $value)) continue;
        $id = 's'.substr(md5('color:'.$value), 0, 7);
        if (count($colors) >= 128 && !isset($colors[$id])) continue;
        $colors[$id] = array('_id'=>$id, 'title'=>'Studio '.$value, 'color'=>$value);
        $s['__globals__'][$key] = 'globals/colors?id='.$id;
        unset($s[$key]);
      }
      if (!empty($s['typography_font_family'])) {
        $font = array();
        foreach ($s as $key=>$value) if (preg_match('/^typography_(font_family|font_size|font_weight|line_height|letter_spacing|text_transform)$/', $key)) $font[$key]=$value;
        ksort($font); $id='s'.substr(md5(wp_json_encode($font)),0,7);
        if (count($fonts)<128 || isset($fonts[$id])) {
          $fonts[$id]=array_merge(array('_id'=>$id,'title'=>'Studio '.$s['typography_font_family'],'typography_typography'=>'custom'),$font);
          $s['__globals__']['typography_typography']='globals/typography?id='.$id;
          foreach ($font as $key=>$value) unset($s[$key]);
          unset($s['typography_typography']);
        }
      }
      $walk($e['elements']);
    }
  };
  // Index existing custom entries to preserve their identity and values.
  $colors=array_column($colors,null,'_id'); $fonts=array_column($fonts,null,'_id');
  foreach ($pages as &$page) $walk($page['elements']);
  $kit_settings['custom_colors']=array_values($colors);
  $kit_settings['custom_typography']=array_values($fonts);
  return $kit_settings;
}
// Selected Google Fonts travel with the draft; arbitrary stylesheet URLs are never imported.
function estudio_clean_fonts($fonts) {
  if (!is_array($fonts) || count($fonts) > 100) throw new Exception('Invalid font manifest.');
  $out = array();
  foreach ($fonts as $font) {
    if (!is_array($font)) throw new Exception('Invalid font entry.');
    $family = trim((string)($font['family'] ?? ''));
    if (!preg_match('/^[\p{L}\p{N}][\p{L}\p{N} .+_-]{0,99}$/u', $family)) throw new Exception('Invalid font family.');
    $clean = array('family'=>$family);
    foreach (array('weights','italicWeights') as $key) {
      $values = $font[$key] ?? array();
      if (!is_array($values) || count($values) > 20) throw new Exception('Invalid font styles.');
      $clean[$key] = array();
      foreach ($values as $value) {
        if (!is_int($value) || $value < 1 || $value > 1000) throw new Exception('Invalid font weight.');
        $clean[$key][] = $value;
      }
      $clean[$key] = array_values(array_unique($clean[$key])); sort($clean[$key]);
    }
    if (empty($clean['weights']) && empty($clean['italicWeights'])) throw new Exception('Missing font styles.');
    $out[$family] = $clean;
  }
  return array_values($out);
}
function estudio_font_url($font) {
  $font = estudio_clean_fonts(array($font))[0];
  if (!empty($font['italicWeights'])) {
    $styles = array();
    foreach ($font['weights'] as $weight) $styles[] = '0,'.$weight;
    foreach ($font['italicWeights'] as $weight) $styles[] = '1,'.$weight;
    $spec = ':ital,wght@'.implode(';', $styles);
  } else $spec = ':wght@'.implode(';', $font['weights']);
  return 'https://fonts.googleapis.com/css2?family='.rawurlencode($font['family']).$spec.'&display=swap';
}
add_filter('elementor/fonts/additional_fonts', function ($fonts) {
  foreach ((array)get_option('estudio_font_families', array()) as $family) {
    if (is_string($family) && preg_match('/^[\p{L}\p{N}][\p{L}\p{N} .+_-]{0,99}$/u', $family)) $fonts[$family] = 'googlefonts';
  }
  return $fonts;
});
add_action('wp_enqueue_scripts', function () {
  if (!is_singular()) return;
  $fonts = get_post_meta(get_queried_object_id(), '_estudio_fonts', true);
  if (!is_array($fonts)) return;
  try {
    foreach (estudio_clean_fonts($fonts) as $font) {
      $url = estudio_font_url($font);
      wp_enqueue_style('estudio-font-'.substr(md5($url),0,12), $url, array(), null);
    }
  } catch (Throwable $e) { /* Do not output untrusted font metadata. */ }
});
function estudio_clean_source_fonts($fonts) {
  if (!is_array($fonts) || count($fonts)>24) throw new Exception('Invalid source font manifest.');
  $clean=array();
  foreach ($fonts as $f) {
    if (!is_array($f)) throw new Exception('Invalid source font.');
    $family=$f['family']??''; $url=$f['url']??''; $weight=$f['weight']??''; $style=$f['style']??'';
    if (!is_string($family) || !preg_match('/^[\p{L}\p{N}][\p{L}\p{N} .+_*-]{0,99}$/u',$family) ||
        !is_string($url) || strlen($url)>2500 || !filter_var($url,FILTER_VALIDATE_URL) || !preg_match('/^https?:\/\//',$url) || preg_match('/[\s"\'<>\\\\(){}]/',$url) ||
        !is_string($weight) || !preg_match('/^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/',$weight) ||
        !in_array($style,array('normal','italic','oblique'),true)) throw new Exception('Invalid source font.');
    $clean[]=array('family'=>$family,'url'=>$url,'weight'=>$weight,'style'=>$style);
  }
  return $clean;
}
add_filter('elementor/fonts/additional_fonts',function($fonts) {
  foreach ((array)get_option('estudio_source_font_families',array()) as $family)
    if (is_string($family) && preg_match('/^[\p{L}\p{N}][\p{L}\p{N} .+_*-]{0,99}$/u',$family)) $fonts[$family]='custom';
  return $fonts;
});
add_action('wp_enqueue_scripts',function() {
  if (!is_singular()) return;
  $fonts=get_post_meta(get_queried_object_id(),'_estudio_source_fonts',true);
  if (!is_array($fonts) || !$fonts) return;
  try {
    $css='';
    foreach (estudio_clean_source_fonts($fonts) as $f) $css.='@font-face{font-family:"'.$f['family'].'";src:url("'.$f['url'].'");font-weight:'.$f['weight'].';font-style:'.$f['style'].';font-display:swap}';
    wp_register_style('estudio-source-fonts',false,array(),null);wp_enqueue_style('estudio-source-fonts');wp_add_inline_style('estudio-source-fonts',$css);
  } catch (Throwable $e) {}
});

function estudio_screen() {
  if (!current_user_can('manage_options') || !current_user_can('upload_files')) return;
  echo '<div class="wrap"><h1>Elementor Studio</h1><p>Import your exported ZIP. New pages are created as drafts. Existing pages, theme and homepage stay unchanged.</p>';
  if (!defined('ELEMENTOR_VERSION')) { echo '<p>Install and activate Elementor first.</p></div>'; return; }
  if (!class_exists('ZipArchive')) { echo '<p>Your server needs the PHP ZIP extension.</p></div>'; return; }
  if (isset($_POST['estudio_import'])) {
    check_admin_referer('estudio_import');
    $zip = new ZipArchive(); $opened = false; $created_pages = array(); $created_media = array(); $kit_id=0; $old_kit=null;
    try {
      $file = $_FILES['package'] ?? null;
      if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 20000000 || !is_uploaded_file($file['tmp_name'])) throw new Exception('Upload a ZIP smaller than 20 MB.');
      if ($zip->open($file['tmp_name']) !== true) throw new Exception('Invalid package.');
      $opened = true;
      if ($zip->numFiles > 200) throw new Exception('Package contains too many files.');
      $manifestStat = $zip->statName('studio-manifest.json');
      if (!$manifestStat || $manifestStat['size'] > 200000) throw new Exception('Missing or oversized manifest.');
      $manifestText = $zip->getFromName('studio-manifest.json');
      if ($manifestText === false || strlen($manifestText) > 200000) throw new Exception('Missing package manifest.');
      $manifest = json_decode($manifestText, true);
      if (($manifest['format'] ?? '') !== 'elementor-studio-v2' || !is_array($manifest['pages'] ?? null) || count($manifest['pages']) > 3) throw new Exception('Unsupported package.');
      // Validate every page before making changes.
      $pages = array();
      foreach ($manifest['pages'] as $path) {
        if (!preg_match('#^templates/[a-z0-9-]+\.json$#', $path)) throw new Exception('Invalid page path.');
        $stat = $zip->statName($path);
        if (!$stat || $stat['size'] > 3000000) throw new Exception('Page exceeds package limits.');
        $template = json_decode($zip->getFromName($path), true);
        if (($template['version'] ?? '') !== '0.4') throw new Exception('Unsupported Elementor format.');
        $count = 0;
        $pages[] = array('title'=>sanitize_text_field($template['title'] ?? 'Imported page'), 'elements'=>estudio_clean_elements($template['content'] ?? null, 0, $count), 'source_fonts'=>estudio_clean_source_fonts($template['studio_source_fonts'] ?? array()), 'fonts'=>estudio_clean_fonts($template['studio_fonts'] ?? array()));
      }
      $media = array(); $total = 0;
      foreach (array_slice($manifest['media'] ?? array(), 0, 40) as $asset) {
        $path = $asset['path'] ?? '';
        if (!preg_match('#^media/image-[0-9]+\.(png|jpg|webp|gif)$#', $path)) continue;
        $stat = $zip->statName($path);
        if (!$stat || $stat['size'] > 1000000 || ($total += $stat['size']) > 12000000) continue;
        $bytes = $zip->getFromName($path);
        if (!$bytes || !@getimagesizefromstring($bytes)) continue;
        $upload = wp_upload_bits(wp_unique_filename(wp_upload_dir()['path'], basename($path)), null, $bytes);
        if ($upload['error']) continue;
        $checked = wp_check_filetype_and_ext($upload['file'], basename($upload['file']));
        if (empty($checked['type']) || strpos($checked['type'], 'image/') !== 0) { wp_delete_file($upload['file']); continue; }
        $id = wp_insert_attachment(array('post_mime_type'=>$checked['type'], 'post_title'=>basename($path), 'post_status'=>'inherit'), $upload['file'], 0, true);
        if (is_wp_error($id)) { wp_delete_file($upload['file']); continue; }
        $created_media[] = $id;
        require_once ABSPATH . 'wp-admin/includes/image.php';
        wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $upload['file']));
        $media[$asset['url']] = array('id'=>$id, 'url'=>$upload['url']);
      }
      if (!empty($_POST['studio_globals'])) {
        $kit_id=(int)get_option('elementor_active_kit');
        if (!$kit_id) throw new Exception('Create an active Elementor Site Kit before importing global styles.');
        $old_kit=get_post_meta($kit_id, '_elementor_page_settings', true);
        $next_kit=estudio_global_styles($pages, is_array($old_kit)?$old_kit:array());
        update_post_meta($kit_id, '_elementor_page_settings', $next_kit);
        \Elementor\Plugin::$instance->files_manager->clear_cache();
      }
      foreach ($pages as $page) {
        estudio_remap($page['elements'], $media);
        $id = wp_insert_post(array('post_type'=>'page','post_status'=>'draft','post_title'=>$page['title']), true);
        if (is_wp_error($id)) throw new Exception($id->get_error_message());
        $created_pages[] = $id;
        update_post_meta($id, '_estudio_interactions', strpos(wp_json_encode($page['elements']), 'estudio-') !== false ? '1' : '0');
        update_post_meta($id, '_estudio_fonts', $page['fonts']);
        update_post_meta($id, '_estudio_source_fonts', $page['source_fonts']);
        update_post_meta($id, '_elementor_edit_mode', 'builder');
        update_post_meta($id, '_elementor_template_type', 'wp-page');
        update_post_meta($id, '_elementor_version', ELEMENTOR_VERSION);
        update_post_meta($id, '_wp_page_template', 'elementor_canvas');
        update_post_meta($id, '_elementor_data', wp_slash(wp_json_encode($page['elements'])));
        estudio_refresh_page_css($id);
        echo '<p>Draft created: <a href="'.esc_url(admin_url('post.php?post='.$id.'&action=elementor')).'">'.esc_html($page['title']).' — Edit with Elementor</a></p>';
      }
      $source_registered=(array)get_option('estudio_source_font_families',array());
      foreach ($pages as $page) foreach ($page['source_fonts'] as $font) $source_registered[]=$font['family'];
      update_option('estudio_source_font_families',array_values(array_unique($source_registered)),false);
      $registered = (array)get_option('estudio_font_families', array());
      foreach ($pages as $page) foreach ($page['fonts'] as $font) $registered[] = $font['family'];
      update_option('estudio_font_families', array_values(array_unique($registered)), false);
      echo '<p>Review pages, replace source links and remaining external images, then publish when ready. Store/cart/checkout need separate WooCommerce setup.</p>';
    } catch (Throwable $e) { if ($kit_id && $old_kit !== null) update_post_meta($kit_id, '_elementor_page_settings', $old_kit); foreach ($created_pages as $created_id) wp_delete_post($created_id, true); foreach ($created_media as $created_id) wp_delete_attachment($created_id, true); echo '<div class="notice notice-error"><p>'.esc_html($e->getMessage()).'</p></div>'; }
    if ($opened) $zip->close();
  }
  echo '<form method="post" enctype="multipart/form-data">'; wp_nonce_field('estudio_import');
  echo '<input type="file" name="package" accept=".zip" required><p><label><input type="checkbox" name="studio_globals" value="1"> Add imported colours and fonts as new Elementor Global Styles (existing styles stay unchanged)</label></p><p><button class="button button-primary" name="estudio_import" value="1">Import as draft pages</button></p></form></div>';
}

// BEGIN STUDIO RUNTIME
add_action('wp_enqueue_scripts', function () {
  if (!is_singular() || get_post_meta(get_queried_object_id(), '_estudio_interactions', true) !== '1') return;
  wp_register_style('estudio-runtime', false, array(), '0.4.10'); wp_enqueue_style('estudio-runtime');
  wp_add_inline_style('estudio-runtime', <<<'ESTUDIOCSS'
body.estudio-runtime .estudio-disclosure:not(.estudio-expanded)>:not(:first-child){display:none!important}body.estudio-runtime .estudio-panel:not(.estudio-open){display:none!important}.estudio-panel{box-sizing:border-box}.estudio-panel.estudio-open{display:flex!important}body.estudio-runtime .estudio-panel{position:fixed!important;top:0;left:0;z-index:10000;max-height:100vh;overflow:auto}body.elementor-editor-active .estudio-panel{position:static!important;height:auto!important;z-index:auto!important}.estudio-panel :focus-visible,[class*="estudio-toggle-"]:focus-visible{outline:2px solid #147d68;outline-offset:3px}.estudio-product img{transition:transform .25s ease}.estudio-product img:hover{transform:scale(1.04)}.estudio-product{overflow:hidden}.estudio-catalog-controls{display:flex;flex-wrap:wrap;gap:12px;padding:16px;align-items:center;background:#fff;color:#222;width:100%}.estudio-catalog-controls input,.estudio-catalog-controls select,.estudio-quick-button{padding:10px;border:1px solid #ccc;background:#fff;color:#222;font:inherit}.estudio-quick-button{cursor:pointer;margin:8px}.estudio-quick{max-width:700px;width:90vw;max-height:85vh;overflow:auto;border:0;border-radius:12px;padding:24px;background:white;color:#222}.estudio-quick::backdrop{background:#0009}.estudio-quick img{max-height:50vh;max-width:100%;object-fit:contain}.estudio-quick button{padding:10px;float:right}.estudio-quick p{padding:16px 0}@media(prefers-reduced-motion:reduce){.estudio-product img{transition:none}}
ESTUDIOCSS
  );
  wp_register_script('estudio-runtime', false, array(), '0.4.10', true); wp_enqueue_script('estudio-runtime');
  wp_add_inline_script('estudio-runtime', <<<'ESTUDIOJS'
(()=>{
 if(document.body.classList.contains('elementor-editor-active')||new URLSearchParams(location.search).has('elementor-preview')||(window.elementorFrontend&&window.elementorFrontend.isEditMode()))return;
 document.body.classList.add('estudio-runtime');
 const cards=Array.from(document.querySelectorAll(document.querySelector('.estudio-tools')?'.estudio-product':'.estudio-product-tools-disabled')).filter(c=>!c.parentElement.closest('.estudio-product'));
 const groups=new Map();
 cards.forEach(card=>{const parent=card.parentElement;if(!groups.has(parent))groups.set(parent,[]);groups.get(parent).push(card);
   const button=document.createElement('button');button.type='button';button.className='estudio-quick-button';button.textContent='Quick preview';
   const content=card.innerText.trim();
   button.addEventListener('click',()=>{const modal=document.createElement('dialog');modal.className='estudio-quick';modal.setAttribute('aria-label','Product quick preview');const close=document.createElement('button');close.textContent='Close ×';close.type='button';const dismiss=()=>{modal.close();modal.remove();button.focus();};close.onclick=dismiss;modal.addEventListener('cancel',e=>{e.preventDefault();dismiss();});modal.append(close);const image=card.querySelector('img');if(image){const copy=image.cloneNode();copy.removeAttribute('id');copy.removeAttribute('style');modal.append(copy);}const text=document.createElement('p');text.textContent=content;modal.append(text);document.body.append(modal);modal.showModal();});card.append(button);
 });
 groups.forEach((items,parent)=>{if(items.length<2)return;const bar=document.createElement('div');bar.className='estudio-catalog-controls';const search=document.createElement('input');search.type='search';search.placeholder='Search captured products';search.setAttribute('aria-label','Search captured products');const sort=document.createElement('select');sort.setAttribute('aria-label','Sort captured products');[['original','Original order'],['az','Name A–Z'],['low','Price low to high'],['high','Price high to low']].forEach(pair=>{const o=document.createElement('option');o.value=pair[0];o.textContent=pair[1];sort.append(o);});const count=document.createElement('span');count.setAttribute('role','status');const entries=items.map((card,index)=>{const text=card.innerText.replace('Quick preview','').trim();const match=text.match(/(?:£|[$]|€)[ ]*([0-9][0-9,]*(?:[.][0-9]{1,2})?)/);return{card,index,text,price:match?Number(match[1].replace(/,/g,'')):null};});const apply=()=>{let shown=0;const ordered=entries.slice().sort((a,b)=>{if(sort.value==='az')return a.text.localeCompare(b.text);if(sort.value==='original')return a.index-b.index;if(a.price===null)return b.price===null?0:1;if(b.price===null)return -1;return sort.value==='low'?a.price-b.price:b.price-a.price;});ordered.forEach(item=>{const visible=item.text.toLowerCase().includes(search.value.toLowerCase());item.card.style.setProperty('display',visible?'':'none',visible?'':'important');parent.append(item.card);if(visible)shown++;});count.textContent=shown+' / '+entries.length+' captured products';};search.addEventListener('input',apply);sort.addEventListener('change',apply);bar.append(search,sort,count);parent.before(bar);document.querySelectorAll('a,button').forEach(trigger=>{const label=trigger.textContent.trim().toLowerCase();if(label==='sort by'||label==='filter by'){trigger.addEventListener('click',e=>{e.preventDefault();bar.scrollIntoView({block:'center',behavior:'smooth'});(label==='sort by'?sort:search).focus();});}});apply();});
 const find=id=>document.querySelector('.estudio-panel-'+id);
 const triggers=id=>document.querySelectorAll('.estudio-toggle-'+id);
 let opener=null;
 const close=p=>{p.classList.remove('estudio-open');p.setAttribute('aria-hidden','true');triggers(p.dataset.estudioPanel).forEach(t=>t.setAttribute('aria-expanded','false'));if(opener&&document.contains(opener))opener.focus();};
 document.querySelectorAll('.estudio-panel').forEach(p=>{const cls=Array.from(p.classList).find(c=>/^estudio-panel-[a-f0-9]{7,8}$/.test(c));if(!cls)return;const id=cls.slice(14);p.dataset.estudioPanel=id;p.id='estudio-panel-'+id;p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-label','Navigation');p.setAttribute('aria-hidden','true');});
 document.querySelectorAll('[class*="estudio-toggle-"]').forEach(t=>{const cls=Array.from(t.classList).find(c=>/^estudio-toggle-[a-f0-9]{7,8}$/.test(c));if(!cls)return;const id=cls.slice(15);t.setAttribute('aria-controls','estudio-panel-'+id);t.setAttribute('aria-expanded','false');t.setAttribute('role','button');t.tabIndex=0;});
 document.querySelectorAll('.estudio-disclosure').forEach(p=>{const t=p.firstElementChild;if(t){t.setAttribute('role','button');t.tabIndex=0;t.setAttribute('aria-expanded','false');}});
 document.addEventListener('click',e=>{const d=e.target.closest('.estudio-disclosure');if(d&&d.firstElementChild.contains(e.target)){e.preventDefault();const open=d.classList.toggle('estudio-expanded');d.firstElementChild.setAttribute('aria-expanded',String(open));return;}const t=e.target.closest('[class*="estudio-toggle-"],[class*="estudio-close-"]');if(!t)return;const cls=Array.from(t.classList).find(c=>/^estudio-(toggle|close)-[a-f0-9]{7,8}$/.test(c));if(!cls)return;e.preventDefault();const id=cls.split('-').pop(),p=find(id);if(!p)return;if(cls.startsWith('estudio-close-')||p.classList.contains('estudio-open')){close(p);return;}document.querySelectorAll('.estudio-panel.estudio-open').forEach(close);opener=t;p.classList.add('estudio-open');p.setAttribute('aria-hidden','false');triggers(id).forEach(x=>x.setAttribute('aria-expanded','true'));const first=p.querySelector('button,a[href],[tabindex="0"]');if(first)first.focus();});
 document.addEventListener('keydown',e=>{const d=e.target.closest('.estudio-disclosure');if(d&&e.target===d.firstElementChild&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click();return;}const p=document.querySelector('.estudio-panel.estudio-open');if(e.key==='Escape'&&p){e.preventDefault();close(p);}if(e.key==='Tab'&&p){const xs=Array.from(p.querySelectorAll('button,a[href],[tabindex="0"]')).filter(x=>x.getBoundingClientRect().height);const a=xs[0],b=xs[xs.length-1];if(a&&e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(b&&!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}const t=e.target.closest('[class*="estudio-toggle-"]');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();t.click();}});
})();
ESTUDIOJS
  );
});
