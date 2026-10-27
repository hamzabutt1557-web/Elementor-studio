<?php
/**
 * Plugin Name: Elementor Studio Importer
 * Description: Import an Elementor Studio ZIP as editable draft WordPress pages with packaged media.
 * Version: 0.4.16
 * Requires PHP: 7.4
 */
if (!defined('ABSPATH')) exit;
// Register search styling independently of imported-page metadata so bare JSON
// imports and widgets added directly inside Elementor also receive it.
add_action('elementor/frontend/after_register_styles', function() {
  wp_register_style('estudio-search', false, array(), '0.4.16');
  wp_add_inline_style('estudio-search', '.estudio-search-form{margin:0;padding:0;display:block}.estudio-search-input{box-sizing:border-box;display:block;width:100%;min-width:0;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;line-height:inherit;box-shadow:none}.estudio-search-input::placeholder{color:inherit;opacity:1}.estudio-search-input:focus-visible{outline:2px solid currentColor;outline-offset:2px}');
});
// A free Elementor widget backed by WordPress's local search endpoint.
add_action('elementor/widgets/register', function($manager) {
  if (!class_exists('Estudio_Search_Widget')) {
    class Estudio_Search_Widget extends \Elementor\Widget_Base {
      public function get_name() { return 'estudio-search'; }
      public function get_title() { return 'Studio Site Search'; }
      public function get_icon() { return 'eicon-search'; }
      public function get_style_depends() { return array('estudio-search'); }
      public function get_categories() { return array('general'); }
      protected function register_controls() {
        $this->start_controls_section('studio_search_content', array('label'=>'Site search'));
        $this->add_control('studio_search_placeholder', array('label'=>'Placeholder','type'=>\Elementor\Controls_Manager::TEXT,'default'=>'Search'));
        $this->add_control('studio_search_note', array('type'=>\Elementor\Controls_Manager::RAW_HTML,'raw'=>'Searches this WordPress site. Keep the Studio importer active. Source-site filters are not copied.'));
        $this->end_controls_section();
        $this->start_controls_section('studio_search_style', array('label'=>'Search style','tab'=>\Elementor\Controls_Manager::TAB_STYLE));
        $this->add_control('text_color', array('label'=>'Text colour','type'=>\Elementor\Controls_Manager::COLOR,'selectors'=>array('{{WRAPPER}} .estudio-search-input'=>'color:{{VALUE}};')));
        $this->add_group_control(\Elementor\Group_Control_Typography::get_type(), array('name'=>'typography','selector'=>'{{WRAPPER}} .estudio-search-input'));
        $this->add_responsive_control('align', array('label'=>'Text alignment','type'=>\Elementor\Controls_Manager::SELECT,'options'=>array('left'=>'Left','center'=>'Centre','right'=>'Right'),'selectors'=>array('{{WRAPPER}} .estudio-search-input'=>'text-align:{{VALUE}};')));
        $this->end_controls_section();
      }
      protected function render() {
        $settings = $this->get_settings_for_display();
        echo '<form class="estudio-search-form" role="search" method="get" action="'.esc_url(home_url('/')).'">';
        echo '<input class="estudio-search-input" type="search" name="s" aria-label="Search this site" maxlength="200" placeholder="'.esc_attr($settings['studio_search_placeholder'] ?? 'Search').'" value="">';
        echo '</form>';
      }
    }
  }
  $manager->register(new Estudio_Search_Widget());
});

// Contact messages stay on the destination WordPress installation.
add_action('init', function() {
  register_post_type('estudio_message', array(
    'labels'=>array('name'=>'Studio Messages','singular_name'=>'Studio Message'),
    'public'=>false,'publicly_queryable'=>false,'show_ui'=>true,'show_in_rest'=>false,
    'exclude_from_search'=>true,'rewrite'=>false,'query_var'=>false,
    'supports'=>array('title','editor'),'map_meta_cap'=>false,
    'capabilities'=>array_fill_keys(array('edit_post','read_post','delete_post','edit_posts','edit_others_posts','publish_posts','read_private_posts','delete_posts','delete_private_posts','delete_published_posts','delete_others_posts','edit_private_posts','edit_published_posts'), 'manage_options') + array('create_posts'=>'do_not_allow'),
    'menu_icon'=>'dashicons-email-alt',
  ));
});
function estudio_has_contact_widget($nodes, $id, $depth=0) {
  if (!is_array($nodes) || $depth > 24) return false;
  foreach ($nodes as $node) {
    if (($node['id'] ?? '') === $id && ($node['widgetType'] ?? '') === 'estudio-contact') return true;
    if (estudio_has_contact_widget($node['elements'] ?? array(), $id, $depth+1)) return true;
  }
  return false;
}
function estudio_submit_contact() {
  nocache_headers();
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') wp_send_json_error(array('message'=>'Use the contact form to submit a message.'),405);
  $read = function($key) { return isset($_POST[$key]) && is_string($_POST[$key]) ? trim(wp_unslash($_POST[$key])) : ''; };
  $page = absint($read('studio_page'));
  $widget = $read('studio_widget');
  if (!preg_match('/^[a-f0-9]{7,8}$/', $widget) || get_post_status($page) !== 'publish' || post_password_required($page) ||
      !estudio_has_contact_widget(json_decode(get_post_meta($page,'_elementor_data',true),true),$widget) ||
      !wp_verify_nonce($read('studio_nonce'),'estudio_contact_'.$page.'_'.$widget)) {
    wp_send_json_error(array('message'=>'This form expired or is unavailable. Refresh the page and try again.'),403);
  }
  if ($read('studio_website') !== '') wp_send_json_error(array('message'=>'Submission rejected.'),400);
  $name = sanitize_text_field($read('studio_name'));
  $email = $read('studio_email');
  $message = sanitize_textarea_field($read('studio_message'));
  if ($name === '' || strlen($name)>200 || !is_email($email) || strlen($email)>254 || $message === '' || strlen($message)>10000) {
    wp_send_json_error(array('message'=>'Enter a name, valid email and message (maximum 10,000 bytes).'),422);
  }
  // Basic per-address throttle; shared proxies share the quota. Not a distributed abuse firewall.
  $key = 'estudio_contact_'.hash_hmac('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown',wp_salt());
  $count = (int)get_transient($key);
  if ($count >= 5) wp_send_json_error(array('message'=>'Too many messages. Please try again in 10 minutes.'),429);
  set_transient($key,$count+1,10*MINUTE_IN_SECONDS);
  $saved = wp_insert_post(wp_slash(array('post_type'=>'estudio_message','post_status'=>'private',
    'post_title'=>$name,'post_content'=>"Email: ".$email."\nPage: ".$page."\n\n".$message)),true);
  if (is_wp_error($saved) || !$saved) wp_send_json_error(array('message'=>'Your message could not be saved. Please try again.'),500);
  wp_send_json_success(array('message'=>'Thank you. Your message has been saved.'));
}
add_action('admin_post_estudio_contact','estudio_submit_contact');
add_action('admin_post_nopriv_estudio_contact','estudio_submit_contact');
add_action('elementor/frontend/after_register_styles',function() {
  wp_register_style('estudio-contact',false,array(),'0.4.16');
  wp_add_inline_style('estudio-contact','.estudio-contact{display:grid;gap:16px;margin:0}.estudio-contact label{display:grid;gap:6px;font:inherit}.estudio-contact input,.estudio-contact textarea{box-sizing:border-box;width:100%;padding:12px;border:1px solid #94a3b8;border-radius:6px;background:#fff;color:#172033;font:inherit}.estudio-contact textarea{min-height:130px;resize:vertical}.estudio-contact button{padding:12px 20px;border:0;border-radius:6px;background:#147d68;color:#fff;font:inherit;cursor:pointer}.estudio-contact :focus-visible{outline:2px solid #147d68;outline-offset:3px}.estudio-contact button:disabled{opacity:.6;cursor:wait}.estudio-contact .estudio-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}.estudio-contact [role=status]{margin:0}');
});
add_action('elementor/frontend/after_register_scripts',function() {
  wp_register_script('estudio-contact',false,array(),'0.4.16',true);
  wp_add_inline_script('estudio-contact', <<<'CONTACTJS'
document.addEventListener('submit',async function(event){
 const form=event.target;if(!form.matches('.estudio-contact'))return;event.preventDefault();
 if(form.dataset.busy==='1')return;
 const button=form.querySelector('button[type=submit]'),status=form.querySelector('[role=status]');
 form.dataset.busy='1';button.disabled=true;status.textContent='Sending…';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const response=await fetch(form.getAttribute('action'),{method:'POST',body:new FormData(form),credentials:'same-origin',signal:controller.signal});const result=await response.json();status.textContent=result.data?.message||'Unable to submit. Please try again.';if(response.ok&&result.success)form.reset();}
 catch(error){status.textContent='Could not confirm delivery. Please check your connection before trying again.';}
 finally{clearTimeout(timer);delete form.dataset.busy;button.disabled=false;}
});
CONTACTJS
  );
});
add_action('elementor/widgets/register',function($manager) {
  if (!class_exists('Estudio_Contact_Widget')) {
    class Estudio_Contact_Widget extends \Elementor\Widget_Base {
      public function get_name(){return 'estudio-contact';}
      public function get_title(){return 'Studio Contact Form';}
      public function get_icon(){return 'eicon-form-horizontal';}
      public function get_categories(){return array('general');}
      public function get_style_depends(){return array('estudio-contact');}
      public function get_script_depends(){return array('estudio-contact');}
      protected function register_controls(){
        $this->start_controls_section('studio_contact_content',array('label'=>'Contact form'));
        foreach(array('name'=>'Name','email'=>'Email','message'=>'Message','button'=>'Send message') as $key=>$label) {
          $this->add_control('studio_contact_'.$key,array('label'=>ucfirst($key).' label','type'=>\Elementor\Controls_Manager::TEXT,'default'=>$label));
        }
        $this->add_control('studio_contact_note',array('type'=>\Elementor\Controls_Manager::RAW_HTML,'raw'=>'Messages are saved in WordPress → Studio Messages (administrators only). Publish this page and keep the importer active. Email notifications are not enabled. Exclude this page from full-page caching so its form token stays fresh.'));
        $this->end_controls_section();
        $this->start_controls_section('studio_contact_style',array('label'=>'Form style','tab'=>\Elementor\Controls_Manager::TAB_STYLE));
        $this->add_group_control(\Elementor\Group_Control_Typography::get_type(),array('name'=>'typography','selector'=>'{{WRAPPER}} .estudio-contact'));
        $this->add_control('text_color',array('label'=>'Label colour','type'=>\Elementor\Controls_Manager::COLOR,'selectors'=>array('{{WRAPPER}} .estudio-contact'=>'color:{{VALUE}};')));
        $this->end_controls_section();
      }
      protected function render(){
        $s=$this->get_settings_for_display();$page=get_the_ID();$id=$this->get_id();
        echo '<form class="estudio-contact" method="post" action="'.esc_url(admin_url('admin-post.php')).'">';
        echo '<input type="hidden" name="action" value="estudio_contact"><input type="hidden" name="studio_page" value="'.esc_attr($page).'"><input type="hidden" name="studio_widget" value="'.esc_attr($id).'">';
        wp_nonce_field('estudio_contact_'.$page.'_'.$id,'studio_nonce',false);
        echo '<label class="estudio-trap" aria-hidden="true">Leave blank<input name="studio_website" tabindex="-1" autocomplete="off"></label>';
        foreach(array('name'=>'Name','email'=>'Email','message'=>'Message') as $key=>$label){
          echo '<label>'.esc_html($s['studio_contact_'.$key] ?? $label);
          if($key==='message')echo '<textarea name="studio_message" required maxlength="10000"></textarea>';
          else echo '<input name="studio_'.$key.'" type="'.($key==='email'?'email':'text').'" autocomplete="'.$key.'" required maxlength="'.($key==='email'?254:200).'">';
          echo '</label>';
        }
        echo '<button type="submit">'.esc_html($s['studio_contact_button'] ?? 'Send message').'</button><p role="status" aria-live="polite"></p><noscript>JavaScript is required for inline confirmation; submission opens a confirmation response.</noscript></form>';
      }
    }
  }
  $manager->register(new Estudio_Contact_Widget());
});

// Captured display declarations are more specific than Elementor's built-in
// responsive visibility classes. Honor native visibility controls on the frontend.
add_action('elementor/frontend/after_enqueue_styles', function() {
  wp_register_style('estudio-visibility', false, array(), '0.4.16');
  wp_enqueue_style('estudio-visibility');
  wp_add_inline_style('estudio-visibility', '.estudio-node.elementor-widget-image,.estudio-node.elementor-widget-image > .elementor-widget-container{line-height:0}@media(min-width:1025px){body:not(.elementor-editor-active) .elementor .estudio-node.elementor-hidden-desktop{display:none!important}}@media(min-width:768px) and (max-width:1024px){body:not(.elementor-editor-active) .elementor .estudio-node.elementor-hidden-tablet{display:none!important}}@media(max-width:767px){body:not(.elementor-editor-active) .elementor .estudio-node.elementor-hidden-mobile{display:none!important}}');
});

// Legacy Elementor wraps widgets in an extra box. Move the imported widget's
// native spacing/decoration to its measured outer box; ordinary widgets retain
// Elementor's original selectors. The same native controls remain editable.
add_action('elementor/element/after_section_end', function($element,$section_id) {
  if ($element->get_name()==='container' || !in_array($section_id,array('_section_style','_section_background','_section_border'),true)) return;
  foreach ($element->get_controls() as $name=>$control) {
    if (empty($control['selectors']) || !preg_match('/^_(margin|padding|background|border)/',$name)) continue;
    $selectors=array();$changed=false;
    foreach ($control['selectors'] as $selector=>$value) {
      if (strpos($selector,'{{WRAPPER}} > .elementor-widget-container')!==false) {
        $selectors[str_replace('{{WRAPPER}}','{{WRAPPER}}:not(.estudio-node)',$selector)]=$value;
        $selectors[str_replace('{{WRAPPER}} > .elementor-widget-container','{{WRAPPER}}.estudio-node',$selector)]=$value;
        $changed=true;
      } else $selectors[$selector]=$value;
    }
    if ($changed) $element->update_control($name,array('selectors'=>$selectors));
  }
}, 20, 2);

// Free Elementor controls for source flow. Keeping these as native responsive
// controls lets the owner change the imported flow without editing CSS.
add_action('elementor/element/after_section_end', function($element, $section_id) {
  $container = $element->get_name() === 'container';
  if (($container && $section_id !== 'section_layout_container') ||
      (!$container && $section_id !== '_section_style')) return;
  $element->start_controls_section('section_studio_source_layout', array(
    'label'=>'Captured layout', 'tab'=>\Elementor\Controls_Manager::TAB_ADVANCED,
  ));
  if ($container) {
    $element->add_group_control(\Elementor\Group_Control_Typography::get_type(), array('name'=>'typography','selector'=>'{{WRAPPER}}'));
    $element->add_responsive_control('align', array('label'=>'Text alignment','type'=>\Elementor\Controls_Manager::SELECT,'options'=>array('left'=>'Left','center'=>'Center','right'=>'Right'),'selectors'=>array('{{WRAPPER}}'=>'text-align:{{VALUE}};')));
    $element->add_responsive_control('text_color', array('label'=>'Text color','type'=>\Elementor\Controls_Manager::COLOR,'selectors'=>array('{{WRAPPER}}'=>'color:{{VALUE}};')));
  }
  $element->add_responsive_control('studio_position', array('label'=>'Captured position','type'=>\Elementor\Controls_Manager::SELECT,'options'=>array('static'=>'Static','relative'=>'Relative','absolute'=>'Absolute','fixed'=>'Fixed','sticky'=>'Sticky'),'selectors'=>array('{{WRAPPER}}'=>'position:{{VALUE}};--position:{{VALUE}};')));
  foreach (array('left','top') as $offset) $element->add_responsive_control('studio_'.$offset, array('label'=>'Captured '.$offset,'type'=>\Elementor\Controls_Manager::TEXT,'selectors'=>array('{{WRAPPER}}'=>$offset.':{{VALUE}};')));
  $element->add_responsive_control('studio_height', array(
    'label'=>'Captured height (px or auto)', 'type'=>\Elementor\Controls_Manager::TEXT,
    'selectors'=>array('{{WRAPPER}}'=>'height:{{VALUE}};'),
  ));
  $element->add_responsive_control('studio_aspect_ratio', array(
    'label'=>'Width / height ratio (or auto)', 'type'=>\Elementor\Controls_Manager::TEXT,
    'selectors'=>$container ? array('{{WRAPPER}}'=>'aspect-ratio:{{VALUE}};') : array('{{WRAPPER}} img'=>'aspect-ratio:{{VALUE}};'),
  ));
  $element->add_responsive_control('studio_object_position', array(
    'label'=>'Image focal point', 'type'=>\Elementor\Controls_Manager::TEXT,
    'selectors'=>array('{{WRAPPER}}.elementor-widget-image img'=>'object-position:{{VALUE}};'),
  ));
  $element->add_responsive_control('studio_display', array(
    'label'=>'Content flow', 'type'=>\Elementor\Controls_Manager::SELECT,
    'options'=>array(''=>'Elementor default','block'=>'Block','flow-root'=>'Contained block','inline-block'=>'Inline block','flex'=>'Flex','inline-flex'=>'Inline flex','grid'=>'Grid','inline-grid'=>'Inline grid'),
    'selectors'=>array('{{WRAPPER}}'=>'--display:{{VALUE}};display:{{VALUE}};'),
  ));
  foreach (array(
    'float'=>array('none','left','right'),
    'clear'=>array('none','left','right','both'),
    'vertical_align'=>array('baseline','top','middle','bottom','text-top','text-bottom','sub','super'),
  ) as $property => $values) {
    $options = array(''=>'Elementor default');
    foreach ($values as $value) $options[$value] = ucfirst($value);
    $element->add_responsive_control('studio_'.$property, array(
      'label'=>ucfirst(str_replace('_',' ',$property)), 'type'=>\Elementor\Controls_Manager::SELECT,
      'options'=>$options, 'selectors'=>array('{{WRAPPER}}'=>str_replace('_','-',$property).':{{VALUE}};'),
    ));
  }
  $element->add_responsive_control('studio_flex_shrink', array(
    'label'=>'Allow shrinking', 'type'=>\Elementor\Controls_Manager::SLIDER,
    'range'=>array('px'=>array('min'=>0,'max'=>10,'step'=>0.1)),
    'selectors'=>array('{{WRAPPER}}'=>'flex-shrink:{{SIZE}};--flex-shrink:{{SIZE}};'),
  ));
  $element->end_controls_section();
}, 10, 2);
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
    if ($kind === 'widget' && !in_array($e['widgetType'] ?? '', array('heading','text-editor','button','image','video','estudio-search','estudio-contact'), true)) throw new Exception('Unsupported widget.');
    $settings = array();
    foreach (($e['settings'] ?? array()) as $key => $value) {
      if (!preg_match('/^(hide_desktop|hide_tablet|hide_mobile|studio_contact_(name|email|message|button)|studio_search_placeholder|studio_position|studio_left|studio_top|studio_height|studio_aspect_ratio|studio_object_position|studio_display|studio_float|studio_clear|studio_vertical_align|studio_flex_shrink|paragraph_spacing|text_padding|video_type|hosted_url|youtube_url|vimeo_url|controls|container_type|css_classes|_css_classes|position|_position|_offset_x|_offset_y|z_index|_z_index|overflow|height|grid_column|_grid_column|grid_columns_grid|grid_rows_grid|grid_gaps|_padding|_margin|_border_radius|border_border|border_width|border_color|_border_border|_border_width|_border_color|_background_(background|color|image|position|xpos|ypos|size|bg_width|repeat)|html_tag|link_to|title|header_size|editor|text|link|image|image_size|caption_source|content_width|width|min_height|padding|margin|border_radius|background_(background|color|image|position|xpos|ypos|size|bg_width|repeat)|title_color|button_text_color|text_color|align|typography_(typography|font_size|font_family|font_weight|line_height|letter_spacing|text_transform)|flex_(direction|gap|justify_content|align_items|wrap)|_element_(width|custom_width)|object-fit)(_tablet|_mobile)?$/', $key)) continue;
      if ($key === 'studio_search_placeholder' || preg_match('/^studio_contact_(name|email|message|button)$/',$key)) {
        $value = mb_substr(sanitize_text_field((string)$value), 0, 200);
      } elseif (preg_match('/^studio_position(_tablet|_mobile)?$/',$key)) {
        if (!in_array($value,array('static','relative','absolute','fixed','sticky'),true)) continue;
      } elseif (preg_match('/^studio_(left|top)(_tablet|_mobile)?$/',$key)) {
        if (!is_string($value) || !preg_match('/^-?[0-9]+(?:\.[0-9]+)?px$/',$value) || abs((float)$value)>10000) continue;
      } elseif (preg_match('/^studio_height(_tablet|_mobile)?$/',$key)) {
        if (!is_string($value) || !preg_match('/^(auto|[0-9]+(?:\.[0-9]+)?px)$/',$value) || ($value !== 'auto' && (float)$value > 10000)) continue;
      } elseif (preg_match('/^studio_aspect_ratio(_tablet|_mobile)?$/',$key)) {
        if ($value !== 'auto' && (!is_numeric($value) || (float)$value <= 0 || (float)$value > 100)) continue;
        $value = (string)$value;
      } elseif (preg_match('/^studio_object_position(_tablet|_mobile)?$/',$key)) {
        if (!is_string($value) || !preg_match('/^-?[0-9.]+(?:%|px) -?[0-9.]+(?:%|px)$/',$value)) continue;
      } elseif (preg_match('/^studio_display(_tablet|_mobile)?$/', $key)) {
        if (!in_array($value, array('','block','flow-root','inline-block','flex','inline-flex','grid','inline-grid'), true)) continue;
      } elseif (preg_match('/^studio_(float|clear|vertical_align)(_tablet|_mobile)?$/', $key, $match)) {
        $allowed = array('float'=>array('','none','left','right'),'clear'=>array('','none','left','right','both'),'vertical_align'=>array('','baseline','top','middle','bottom','text-top','text-bottom','sub','super'));
        if (!in_array($value, $allowed[$match[1]], true)) continue;
      } elseif (preg_match('/^studio_flex_shrink(_tablet|_mobile)?$/', $key)) {
        if (!is_array($value) || !is_numeric($value['size'] ?? null) || $value['size'] < 0 || $value['size'] > 10) continue;
        $value = array('unit'=>'px','size'=>(float)$value['size'],'sizes'=>array());
      } elseif ($key === 'css_classes' || $key === '_css_classes') {
        $value = implode(' ', array_filter(explode(' ', (string)$value), function($v) { return preg_match('/^estudio-(node|panel|product|disclosure|tools|(?:panel|toggle|close)-[a-f0-9]{7,8})$/', $v); }));
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
        if (!$stat || $stat['size'] > 8000000) throw new Exception('Page exceeds package limits.');
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
  wp_register_style('estudio-runtime', false, array(), '0.4.16'); wp_enqueue_style('estudio-runtime');
  wp_add_inline_style('estudio-runtime', <<<'ESTUDIOCSS'
.estudio-search-form{margin:0;padding:0;display:block}.estudio-search-input{box-sizing:border-box;display:block;width:100%;min-width:0;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;line-height:inherit;box-shadow:none}.estudio-search-input::placeholder{color:inherit;opacity:1}.estudio-search-input:focus-visible{outline:2px solid currentColor;outline-offset:2px}.estudio-node.elementor-widget-button .elementor-button-wrapper{line-height:0}.estudio-node.elementor-widget-button .elementor-button{display:block}body.estudio-runtime .estudio-disclosure:not(.estudio-expanded)>:not(:first-child){display:none!important}body.estudio-runtime .estudio-panel:not(.estudio-open){display:none!important}.estudio-panel{box-sizing:border-box}.estudio-panel.estudio-open{display:flex!important}body.estudio-runtime .estudio-panel{position:fixed!important;top:0;left:0;z-index:10000;max-height:100vh;overflow:auto}body.elementor-editor-active .estudio-panel{position:static!important;height:auto!important;z-index:auto!important}.estudio-panel :focus-visible,[class*="estudio-toggle-"]:focus-visible{outline:2px solid #147d68;outline-offset:3px}.estudio-product img{transition:transform .25s ease}.estudio-product img:hover{transform:scale(1.04)}.estudio-product{overflow:hidden}.estudio-catalog-controls{display:flex;flex-wrap:wrap;gap:12px;padding:16px;align-items:center;background:#fff;color:#222;width:100%}.estudio-catalog-controls input,.estudio-catalog-controls select,.estudio-quick-button{padding:10px;border:1px solid #ccc;background:#fff;color:#222;font:inherit}.estudio-quick-button{cursor:pointer;margin:8px}.estudio-quick{max-width:700px;width:90vw;max-height:85vh;overflow:auto;border:0;border-radius:12px;padding:24px;background:white;color:#222}.estudio-quick::backdrop{background:#0009}.estudio-quick img{max-height:50vh;max-width:100%;object-fit:contain}.estudio-quick button{padding:10px;float:right}.estudio-quick p{padding:16px 0}@media(prefers-reduced-motion:reduce){.estudio-product img{transition:none}}
ESTUDIOCSS
  );
  wp_register_script('estudio-runtime', false, array(), '0.4.16', true); wp_enqueue_script('estudio-runtime');
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
