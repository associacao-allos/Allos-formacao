-- Adiciona role "associado" ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'associado';
