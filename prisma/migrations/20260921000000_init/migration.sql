-- CreateTable
CREATE TABLE `Artist` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `birthYear` INTEGER NULL,
    `deathYear` INTEGER NULL,
    `nationality` VARCHAR(191) NULL,
    `basedIn` VARCHAR(191) NULL,
    `website` VARCHAR(500) NULL,
    `bio` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Artist_slug_key`(`slug`),
    INDEX `Artist_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArchiveEntry` (
    `id` VARCHAR(191) NOT NULL,
    `artistId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `role` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `endYear` INTEGER NULL,
    `venue` VARCHAR(200) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `url` VARCHAR(500) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'in_review',
    `confidence` DOUBLE NULL,
    `sourceText` TEXT NULL,
    `extractedBy` VARCHAR(191) NULL,
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ArchiveEntry_artistId_idx`(`artistId`),
    INDEX `ArchiveEntry_status_idx`(`status`),
    INDEX `ArchiveEntry_type_idx`(`type`),
    INDEX `ArchiveEntry_year_idx`(`year`),
    INDEX `ArchiveEntry_country_idx`(`country`),
    INDEX `ArchiveEntry_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ArchiveEntry` ADD CONSTRAINT `ArchiveEntry_artistId_fkey` FOREIGN KEY (`artistId`) REFERENCES `Artist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

