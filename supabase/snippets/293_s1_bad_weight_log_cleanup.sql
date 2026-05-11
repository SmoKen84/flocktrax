begin;

delete from public.log_weight
where id in (
  'd4f6bf28-76f4-44cb-a7f7-ba46b39ebd38',
  '8b32aa09-eeae-4a34-b47e-4533d2bff3c5',
  '888a328f-aa8c-4f6f-a69c-5b5057e6c9b5',
  '096b0e19-0c1b-4980-8fd5-71f20d36f739'
);

select
  id,
  placement_id,
  sex,
  log_date,
  cnt_weighed,
  avg_weight,
  stddev_weight,
  procure,
  other_note
from public.log_weight
where placement_id = '7c2c4b8c-06dd-4f70-bdf3-6a02af6d5c97'
order by log_date desc, sex;

commit;
