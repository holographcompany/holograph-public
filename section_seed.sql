--
-- PostgreSQL database dump
--

-- Dumped from database version 14.16 (Homebrew)
-- Dumped by pg_dump version 14.16 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: Section; Type: TABLE DATA; Schema: public; Owner: ankushtewari
--

INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('52a45c6e-a0c1-4f01-92ca-178645da6c7c', 'Insurance Accounts', 'insurance-accounts', 'Life, health, auto, and other insurance policies.', 'insurance-accounts', true, '2025-03-12 19:38:08.911', 3);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('69201643-ec86-4e9b-a7ed-6f314a7b4659', 'Vital Documents', 'vital-documents', 'Important documents such as wills, trusts, and advance healthcare directives.', 'vital-documents', true, '2025-03-12 19:38:08.911', 1);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('91c35a4f-b3d3-43db-b6d0-9cac78170aa2', 'Subscriptions', 'subscriptions', 'Newspapers, streaming services, gym memberships, and other subscriptions.', 'subscriptions', true, '2025-03-12 19:38:08.911', 8);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('958850fc-e987-4741-b659-390dba8268bc', 'Home Services', 'home-services', 'Home maintenance and professional service providers for all properties.', 'home-services', true, '2025-03-12 19:38:08.911', 7);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('b90691d8-5371-4461-affd-fbc7f5e76189', 'Personal Properties', 'personal-properties', 'Valuable personal items like jewelry, heirlooms, and collectibles.', 'personal-properties', true, '2025-03-12 19:38:08.911', 5);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('e2358077-9688-4eff-9880-243dfd435a09', 'Utilities', 'utilities', 'Utility services such as electricity, gas, water, and internet.', 'utilities', true, '2025-03-12 19:38:08.911', 6);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('0e83e4d7-9fb5-4732-8af5-3288555a70bc', 'Social Media', 'social-media', 'Digital accounts such as Facebook, X, and LinkedIn.', 'social-media', true, '2025-03-12 19:38:08.911', 9);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('4d2d49c7-caa1-44bf-b739-02481b8cdca7', 'Financial Accounts', 'financial-accounts', 'Bank accounts, investments, and financial assets.', 'financial-accounts', true, '2025-03-12 19:38:08.911', 2);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('4db089ff-0cda-43e8-80ee-5db54cb665ec', 'Properties', 'properties', 'Real properties such as your primary home, investment properties, or land.', 'properties', true, '2025-03-12 19:38:08.911', 4);
INSERT INTO public."Section" (id, name, slug, description, "iconSlug", "isDefault", "createdAt", "order") VALUES ('63082a22-e732-4f14-9216-4bc803b15f96', 'Reward Programs', 'reward-programs', 'Loyalty and reward programs such as hotel and airline points.', 'reward-programs', true, '2025-03-12 19:38:08.911', 10);


--
-- PostgreSQL database dump complete
--

