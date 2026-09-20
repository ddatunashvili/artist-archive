-- CreateTable
CREATE TABLE `EntryImage` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(600) NOT NULL,
    `alt` VARCHAR(300) NULL,
    `credit` VARCHAR(200) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EntryImage_entryId_idx`(`entryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EntryImage` ADD CONSTRAINT `EntryImage_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `ArchiveEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

