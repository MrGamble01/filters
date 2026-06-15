-- Seed data (BUILD_SPEC.md Sections 18). Run after 0001_init.sql.

insert into platforms (key, name) values
  ('appfolio', 'AppFolio'),
  ('rentvine', 'Rentvine'),
  ('buildium', 'Buildium'),
  ('rentmanager', 'RentManager'),
  ('beagle', 'Beagle')
on conflict (key) do nothing;

insert into companies (name, gr_code, address_quirk) values
  ('StarPointe Realty', 'GR0022', null),
  ('Reliant', 'GR0025', null),
  ('Sleep Sound', 'GR0160', null),
  ('AllStates', 'GR0250', null),
  ('43 Realty', 'GR0265', null),
  ('Global Realty', 'GR0267', null),
  ('Edisto Property Management Group', 'GR0270', 'unit_field_is_address'),
  ('Flagship Property Management', 'GR0279', null),
  ('Arrow Property Management', 'GR0294', null),
  ('Keystone Signature Properties', 'GR0296', null),
  ('Five Star Real Estate & PM', 'GR0299', null),
  ('Stars & Stripes', 'GR0302', null),
  ('Remi Emerson', 'GR0303', null),
  ('JAZ', 'GR0357', null),
  ('Red Door Property Management', 'GR0386', null),
  ('Freedom House', 'GR0387', null),
  ('SunCoast', 'GR0541', null),
  ('Hylton & Company', 'GR0592', null),
  ('Vesta Property Management', 'GR0671', null),
  ('PMI Raleighwood', 'GR0680', null),
  ('Sheffield', 'GR0734', null),
  ('Endeavour Realty', 'GR0792', null),
  ('Mission Real Estate', 'GR0798', null),
  ('Innovative Realty', 'GR0802', null),
  ('PMI River City', 'GR0806', null),
  ('J R Grace Realty LLC', 'GR0159', null)
on conflict do nothing;

insert into company_aliases (company_id, alias)
select c.id, a.alias
from (values
  ('Keystone Signature Properties', 'Sig Property Management'),
  ('Sleep Sound', 'Sleepy Sound'),
  ('Arrow Property Management', 'Arrow AL'),
  ('Arrow Property Management', 'Arrow TN'),
  ('Remi Emerson', 'YRIG'),
  ('J R Grace Realty LLC', 'JR Grace'),
  ('J R Grace Realty LLC', 'J R Grace Realty')
) as a(company_name, alias)
join companies c on c.name = a.company_name
on conflict do nothing;
