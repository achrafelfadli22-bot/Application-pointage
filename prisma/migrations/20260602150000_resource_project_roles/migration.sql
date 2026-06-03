DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = '"UserRole"'::regtype
      AND enumlabel = 'TENANT_ADMIN'
  ) THEN
    ALTER TYPE "UserRole" RENAME VALUE 'TENANT_ADMIN' TO 'RESOURCE_MANAGER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = '"UserRole"'::regtype
      AND enumlabel = 'PROJECT_MANAGER'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'PROJECT_MANAGER';
  END IF;
END $$;
