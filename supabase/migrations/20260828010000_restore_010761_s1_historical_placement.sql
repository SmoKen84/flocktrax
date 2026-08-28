-- Restore the S1/B52 drop on ticket 010761 to its historical flock. The feed
-- editor previously excluded archived placements and replaced 293-S1 with the
-- only selectable future placement, 337-S1, when the ticket was saved.
update public.feed_drops
set placement_id = '7c2c4b8c-06dd-4f70-bdf3-6a02af6d5c97'::uuid,
    placement_code = '293-S1'
where id = 'a4802779-4d75-4dab-8e4b-ba6fa56f8bd1'::uuid
  and ticket_num = '010761'
  and bin_code = '52'
  and type = 'Grower'
  and drop_weight = 11335
  and placement_id = 'f2f4cef3-dda9-4e44-a00e-9d6de5d54d9d'::uuid
  and placement_code = '337-S1';
