-- No policy or function uses is_group_member() since 20261012110000 (my_group_id() replaced it).
DROP FUNCTION is_group_member(uuid);
