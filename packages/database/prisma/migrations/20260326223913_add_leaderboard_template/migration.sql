-- CreateTable
CREATE TABLE "leaderboard_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Template classifica',
    "image_path" TEXT NOT NULL,
    "positions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_templates_pkey" PRIMARY KEY ("id")
);
