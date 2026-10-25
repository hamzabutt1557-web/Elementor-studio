<?php
require dirname(__DIR__).'/.qa/wordpress-test/wordpress/wp-load.php';
$id=wp_insert_post(array('post_type'=>'page','post_status'=>'publish','post_title'=>'Contact acceptance'),true);
update_post_meta($id,'_elementor_edit_mode','builder');
update_post_meta($id,'_elementor_template_type','wp-page');
update_post_meta($id,'_elementor_version',ELEMENTOR_VERSION);
update_post_meta($id,'_wp_page_template','elementor_canvas');
$data=array(array('id'=>'abcdef12','elType'=>'widget','widgetType'=>'estudio-contact','settings'=>array('studio_contact_button'=>'Send test message'),'elements'=>array()));
$data=estudio_clean_elements($data);
update_post_meta($id,'_elementor_data',wp_slash(wp_json_encode($data)));
estudio_refresh_page_css($id);
file_put_contents(dirname(__DIR__).'/.qa/contact-id.json',json_encode($id));
$key='estudio_contact_'.hash_hmac('sha256','127.0.0.1',wp_salt());delete_transient($key);
echo "Contact fixture ready\n";
