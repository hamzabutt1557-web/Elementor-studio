<?php
require dirname(__DIR__).'/.qa/wordpress-test/wordpress/wp-load.php';
$rows=get_posts(array('post_type'=>'estudio_message','post_status'=>'private','numberposts'=>20));
$match=false;foreach($rows as $row)if(strpos($row->post_content,'Private contact fixture message.')!==false)$match=$row;
if(!$match)throw new Exception('Message not persisted');
$type=get_post_type_object('estudio_message');
if($type->public || $type->publicly_queryable || $type->show_in_rest)throw new Exception('Public message type');
wp_set_current_user(0);if(current_user_can('read_post',$match->ID))throw new Exception('Anonymous access');
$user=get_user_by('login','contact-qa-editor');
if(!$user){$id=wp_insert_user(array('user_login'=>'contact-qa-editor','user_pass'=>wp_generate_password(32),'role'=>'editor'));$user=get_user_by('id',$id);}
wp_set_current_user($user->ID);if(current_user_can('read_post',$match->ID)||current_user_can('edit_posts','estudio_message')&&current_user_can($type->cap->edit_posts))throw new Exception('Editor inbox access');
$admins=get_users(array('role'=>'administrator','number'=>1));wp_set_current_user($admins[0]->ID);
if(!current_user_can('read_post',$match->ID))throw new Exception('Admin cannot read inbox');
echo "PASS: message persisted privately; anonymous/editor denied; administrator allowed\n";
