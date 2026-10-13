-- modify "walkthroughs" table
ALTER TABLE "walkthroughs" ADD COLUMN "review_pending" boolean NOT NULL DEFAULT false;
