UPDATE "Site"
SET "progressPercent" = CASE
  WHEN "status" = 'COMPLETED' THEN 100
  WHEN "startDate" IS NOT NULL
    AND "plannedEndDate" IS NOT NULL
    AND "plannedEndDate" > "startDate"
    THEN LEAST(
      99,
      GREATEST(
        0,
        FLOOR(((CURRENT_DATE - "startDate")::numeric / NULLIF(("plannedEndDate" - "startDate")::numeric, 0)) * 100)::int
      )
    )
  ELSE "progressPercent"
END
WHERE "progressPercent" = 0;
