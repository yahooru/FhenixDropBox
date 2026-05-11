import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

function uploadInput(overrides: Record<string, unknown> = {}) {
  return {
    ipfsHash: "bafybeigdyrzt5sfp7udm7hu76n4bnz",
    fileName: "private-report.pdf",
    mimeType: "application/pdf",
    fileSize: 12345n,
    price: 0n,
    maxDownloads: 10n,
    expiryDays: 7n,
    accessCodeHash: ZERO_BYTES32,
    contentEncrypted: true,
    encryptionKeyHash: ZERO_BYTES32,
    folderId: 0n,
    previewEnabled: true,
    previewHash: "bafybeipreview",
    anonymousUpload: false,
    ...overrides,
  };
}

describe("FhenixDropBox", function () {
  async function deployFixture() {
    const [owner, buyer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FhenixDropBox");
    const dropbox = await Factory.deploy();
    await dropbox.waitForDeployment();
    return { dropbox, owner, buyer };
  }

  it("uploads a Wave 3 batch with metadata", async function () {
    const { dropbox, owner } = await deployFixture();

    await expect(dropbox.uploadFilesBatch([
      uploadInput({ fileName: "one.pdf" }),
      uploadInput({ fileName: "two.png", mimeType: "image/png", fileSize: 456n }),
    ])).to.emit(dropbox, "FileUploaded");

    expect(await dropbox.totalFiles()).to.equal(2n);
    expect(await dropbox.getMyFiles()).to.deep.equal([0n, 1n]);

    const metadata = await dropbox.getFileMetadata(1);
    expect(metadata.fileName).to.equal("two.png");
    expect(metadata.mimeType).to.equal("image/png");
    expect(metadata.previewEnabled).to.equal(true);

    const stats = await dropbox.getStats();
    expect(stats._myFileCount).to.equal(2n);
    expect(await dropbox.getFileOwner(0)).to.equal(owner.address);
  });

  it("supports anonymous upload visibility without removing owner controls", async function () {
    const { dropbox, owner } = await deployFixture();

    await expect(dropbox.uploadFileDetailed(uploadInput({ anonymousUpload: true })))
      .to.emit(dropbox, "FileUploaded")
      .withArgs(
        0n,
        ethers.ZeroAddress,
        "bafybeigdyrzt5sfp7udm7hu76n4bnz",
        "private-report.pdf",
        0n,
        0n,
        false,
        true,
        "bafybeipreview",
        true
      );

    expect(await dropbox.getFileOwner(0)).to.equal(ethers.ZeroAddress);

    const privacy = await dropbox.getFilePrivacy(0);
    expect(privacy.anonymousUpload).to.equal(true);
    expect(privacy.visibleOwner).to.equal(ethers.ZeroAddress);

    await expect(dropbox.updateFilePrivacy(0, false)).to.emit(dropbox, "FilePrivacyUpdated");
    expect(await dropbox.getFileOwner(0)).to.equal(owner.address);
  });

  it("handles native ETH access payments and download accounting", async function () {
    const { dropbox, owner, buyer } = await deployFixture();
    const price = ethers.parseEther("0.01");

    await dropbox.uploadFileDetailed(uploadInput({ price, maxDownloads: 1n }));

    await expect(
      dropbox.connect(buyer).requestAccess(0, ZERO_BYTES32, { value: ethers.parseEther("0.001") })
    ).to.be.revertedWith("Insufficient payment");

    const ownerBefore = await ethers.provider.getBalance(owner.address);
    await expect(
      dropbox.connect(buyer).requestAccess(0, ZERO_BYTES32, { value: price })
    ).to.emit(dropbox, "FileAccessed");
    const ownerAfter = await ethers.provider.getBalance(owner.address);
    expect(ownerAfter - ownerBefore).to.equal(price);

    const access = await dropbox.connect(buyer).getAccessInfo(0);
    expect(access.isAuthorized).to.equal(true);

    await expect(dropbox.connect(buyer).downloadFile(0)).to.emit(dropbox, "FileDownloaded");
    expect(await dropbox.totalDownloads()).to.equal(1n);
    expect(await dropbox.getRemainingDownloads(0)).to.equal(0n);

    await expect(dropbox.connect(buyer).downloadFile(0)).to.be.revertedWith("No downloads remaining");
  });

  it("supports folders, moving files, webhooks, and batch downloads", async function () {
    const { dropbox } = await deployFixture();

    await expect(dropbox.createFolder("Legal", "#111111")).to.emit(dropbox, "FolderCreated");
    await dropbox.uploadFilesBatch([
      uploadInput({ fileName: "a.pdf", folderId: 1n, maxDownloads: 0n }),
      uploadInput({ fileName: "b.pdf", folderId: 1n, maxDownloads: 0n }),
    ]);

    expect(await dropbox.getFilesByFolder(1)).to.deep.equal([0n, 1n]);

    await expect(dropbox.moveFileToFolder(1, 0)).to.emit(dropbox, "FileMoved");
    expect(await dropbox.getFilesByFolder(1)).to.deep.equal([0n]);
    expect(await dropbox.getFilesByFolder(0)).to.deep.equal([1n]);

    const endpointHash = ethers.keccak256(ethers.toUtf8Bytes("https://example.com/webhook"));
    await expect(dropbox.registerWebhook(endpointHash, "Production", 7)).to.emit(dropbox, "WebhookRegistered");
    const webhook = await dropbox.webhooks(1);
    expect(webhook.endpointHash).to.equal(endpointHash);
    expect(await dropbox.getMyWebhooks()).to.deep.equal([1n]);

    await expect(dropbox.batchDownloadFiles([0, 1])).to.emit(dropbox, "BatchDownloaded");
    expect(await dropbox.totalDownloads()).to.equal(2n);
  });
});
