import { expect } from "chai";
import hre from "hardhat";
import { Encryptable } from "@cofhe/sdk";

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
    const [owner, buyer, expiredSubscriber] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FhenixDropBox");
    const dropbox = await Factory.deploy();
    await dropbox.waitForDeployment();
    return { dropbox, owner, buyer, expiredSubscriber };
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
    const { dropbox, owner, buyer } = await deployFixture();

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
    await expect(dropbox.connect(buyer).getWebhookFileOwner(0)).to.be.reverted;
    await dropbox.setTrustedRelayer(buyer.address, true);
    expect(await dropbox.connect(buyer).getWebhookFileOwner(0)).to.equal(owner.address);

    await expect(dropbox.updateFilePrivacy(0, false)).to.emit(dropbox, "FilePrivacyUpdated");
    expect(await dropbox.getFileOwner(0)).to.equal(owner.address);
  });

  it("handles native ETH access payments and download accounting", async function () {
    const { dropbox, owner, buyer } = await deployFixture();
    const price = ethers.parseEther("0.01");

    await dropbox.uploadFileDetailed(uploadInput({ price, maxDownloads: 1n }));

    await expect(
      dropbox.connect(buyer).requestAccess(0, ZERO_BYTES32, { value: ethers.parseEther("0.001") })
    ).to.be.reverted;

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

    await expect(dropbox.connect(buyer).downloadFile(0)).to.be.reverted;
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

  it("stores Wave 5 CoFHE encrypted rule handles", async function () {
    const { dropbox, owner } = await deployFixture();
    const cofheClient = await hre.cofhe.createClientWithBatteries(owner);
    const [price, maxDownloads, expiresAt, accessHigh, accessLow] = await cofheClient
      .encryptInputs([
        Encryptable.uint128(1000n),
        Encryptable.uint32(3n),
        Encryptable.uint64(123456789n),
        Encryptable.uint128(11n),
        Encryptable.uint128(22n),
      ])
      .execute();

    await expect(dropbox.uploadFilesBatchWithConfidentialRules(
      [uploadInput({ price: 1000n, maxDownloads: 3n })],
      [{
        price,
        maxDownloads,
        expiresAt,
        accessCodeHashHigh: accessHigh,
        accessCodeHashLow: accessLow,
        enabled: true,
      }],
    )).to.emit(dropbox, "ConfidentialRulesUpdated");

    const handles = await dropbox.getConfidentialRuleHandles(0);
    expect(handles.enabled).to.equal(true);
    expect(handles.priceHandle).to.not.equal(ZERO_BYTES32);
    expect(handles.maxDownloadsHandle).to.not.equal(ZERO_BYTES32);
    expect(handles.expiresAtHandle).to.not.equal(ZERO_BYTES32);

    await expect(dropbox.updateFileRules(0, 0, 10, 3, ZERO_BYTES32))
      .to.emit(dropbox, "ConfidentialRulesUpdated")
      .withArgs(0n, false, ZERO_BYTES32, ZERO_BYTES32, ZERO_BYTES32);
    expect((await dropbox.getConfidentialRuleHandles(0)).enabled).to.equal(false);
  });

  it("supports trusted relayed anonymous uploads", async function () {
    const { dropbox, owner, buyer } = await deployFixture();
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("owner recovery salt"));
    const intentHash = ethers.keccak256(ethers.toUtf8Bytes("relayed upload intent 1"));

    await expect(dropbox.setTrustedRelayer(buyer.address, true))
      .to.emit(dropbox, "TrustedRelayerUpdated")
      .withArgs(buyer.address, true);

    await expect(dropbox.connect(buyer).relayedUploadFilesBatch(
      [uploadInput({ anonymousUpload: false })],
      owner.address,
      commitment,
      intentHash,
    )).to.emit(dropbox, "RelayedUpload")
      .withArgs(buyer.address, [0n], commitment, intentHash);

    expect(await dropbox.getFileOwner(0)).to.equal(ethers.ZeroAddress);
    expect(await dropbox.connect(owner).getMyFiles()).to.deep.equal([0n]);

    await expect(dropbox.connect(buyer).relayedUploadFilesBatch(
      [uploadInput({ anonymousUpload: false, fileName: "replay.pdf" })],
      owner.address,
      commitment,
      intentHash,
    )).to.be.reverted;
  });

  it("supports team folder writers and visible team files", async function () {
    const { dropbox, buyer } = await deployFixture();

    await dropbox.createFolder("Team Legal", "#2F6FED");
    await expect(dropbox.createTeam("Core Team")).to.emit(dropbox, "TeamCreated");
    await expect(dropbox.addTeamMember(1, buyer.address, 2)).to.emit(dropbox, "TeamMemberUpdated");
    await expect(dropbox.grantFolderToTeam(1, 1, 1)).to.emit(dropbox, "FolderTeamPermissionUpdated");

    await expect(dropbox.uploadFileDetailed(uploadInput({ folderId: 1n, maxDownloads: 0n })))
      .to.emit(dropbox, "FileUploaded");
    const access = await dropbox.connect(buyer).getAccessInfo(0);
    const encryption = await dropbox.connect(buyer).getEncryptionInfo(0);
    expect(access.isAuthorized).to.equal(true);
    expect(encryption.isOwnerOrAuthorized).to.equal(true);
    await expect(dropbox.connect(buyer).downloadFile(0)).to.emit(dropbox, "FileDownloaded");

    await expect(dropbox.connect(buyer).uploadFileDetailed(uploadInput({ folderId: 1n })))
      .to.emit(dropbox, "FileUploaded");

    expect(await dropbox.connect(buyer).getVisibleFilesByFolder(1)).to.deep.equal([0n, 1n]);
    expect(await dropbox.canWriteFolder(1, buyer.address)).to.equal(true);

    await dropbox.uploadFileDetailed(uploadInput({ folderId: 1n, fileName: "inactive.pdf", maxDownloads: 0n }));
    await dropbox.updateFolder(1, "Team Legal", "#2F6FED", false);
    const inactiveAccess = await dropbox.connect(buyer).getAccessInfo(2);
    expect(await dropbox.canViewFolder(1, buyer.address)).to.equal(false);
    expect(inactiveAccess.isAuthorized).to.equal(false);
    await expect(dropbox.connect(buyer).downloadFile(2)).to.be.reverted;
  });

  it("removes revoked team members from team indexes", async function () {
    const { dropbox, owner, buyer } = await deployFixture();

    await dropbox.createTeam("Core Team");
    await expect(dropbox.addTeamMember(1, owner.address, 1)).to.be.reverted;
    await dropbox.addTeamMember(1, buyer.address, 1);

    expect(await dropbox.connect(buyer).getMyTeams()).to.deep.equal([1n]);
    expect(await dropbox.getTeamMembers(1)).to.include(buyer.address);

    await expect(dropbox.removeTeamMember(1, buyer.address))
      .to.emit(dropbox, "TeamMemberUpdated")
      .withArgs(1n, buyer.address, 0, false);

    expect(await dropbox.connect(buyer).getMyTeams()).to.deep.equal([]);
    expect(await dropbox.getTeamMembers(1)).to.not.include(buyer.address);

    await dropbox.addTeamMember(1, buyer.address, 2);
    expect(await dropbox.connect(buyer).getMyTeams()).to.deep.equal([1n]);
    expect((await dropbox.getTeamMembers(1)).filter((member: string) => member === buyer.address)).to.have.lengthOf(1);
  });

  it("supports recurring access subscriptions", async function () {
    const { dropbox, owner, buyer, expiredSubscriber } = await deployFixture();
    const period = 7n * 24n * 60n * 60n;
    const price = ethers.parseEther("0.002");

    await dropbox.uploadFileDetailed(uploadInput({ maxDownloads: 0n }));
    await expect(dropbox.createSubscriptionPlan(0, price, period, 4))
      .to.emit(dropbox, "SubscriptionPlanCreated");

    const ownerBefore = await ethers.provider.getBalance(owner.address);
    await expect(dropbox.connect(buyer).subscribeToPlan(1, 2, ZERO_BYTES32, { value: price * 2n }))
      .to.emit(dropbox, "SubscriptionPaid");
    const ownerAfter = await ethers.provider.getBalance(owner.address);
    expect(ownerAfter - ownerBefore).to.equal(price * 2n);

    expect(await dropbox.hasActiveSubscription(0, buyer.address)).to.equal(true);
    await expect(dropbox.connect(buyer).downloadFile(0)).to.emit(dropbox, "FileDownloaded");
    await expect(dropbox.connect(buyer).downloadFile(0)).to.be.reverted;

    const consumedAccess = await dropbox.connect(buyer).getAccessInfo(0);
    expect(consumedAccess.hasDownloaded).to.equal(true);

    await expect(dropbox.connect(buyer).subscribeToPlan(1, 1, ZERO_BYTES32, { value: price }))
      .to.emit(dropbox, "SubscriptionPaid");
    const renewedAccess = await dropbox.connect(buyer).getAccessInfo(0);
    expect(renewedAccess.isAuthorized).to.equal(true);
    expect(renewedAccess.hasDownloaded).to.equal(false);
    await expect(dropbox.connect(buyer).downloadFile(0)).to.emit(dropbox, "FileDownloaded");
    expect((await dropbox.connect(buyer).getAccessInfo(0)).hasDownloaded).to.equal(true);

    await dropbox.connect(expiredSubscriber).subscribeToPlan(1, 1, ZERO_BYTES32, { value: price });
    expect(await dropbox.hasActiveSubscription(0, expiredSubscriber.address)).to.equal(true);
    await ethers.provider.send("evm_increaseTime", [Number(period) + 1]);
    await ethers.provider.send("evm_mine", []);
    expect(await dropbox.hasActiveSubscription(0, expiredSubscriber.address)).to.equal(false);
    await expect(dropbox.connect(expiredSubscriber).downloadFile(0)).to.be.reverted;
  });

  it("requires the file PIN before creating subscription access", async function () {
    const { dropbox, buyer } = await deployFixture();
    const pinHash = ethers.keccak256(ethers.toUtf8Bytes("1234"));

    await dropbox.uploadFileDetailed(uploadInput({ accessCodeHash: pinHash, maxDownloads: 0n }));
    await dropbox.createSubscriptionPlan(0, ethers.parseEther("0.001"), 7n * 24n * 60n * 60n, 0);

    await expect(
      dropbox.connect(buyer).subscribeToPlan(1, 1, ZERO_BYTES32, { value: ethers.parseEther("0.001") })
    ).to.be.reverted;

    await expect(
      dropbox.connect(buyer).subscribeToPlan(1, 1, pinHash, { value: ethers.parseEther("0.001") })
    ).to.emit(dropbox, "SubscriptionPaid");
  });
});
