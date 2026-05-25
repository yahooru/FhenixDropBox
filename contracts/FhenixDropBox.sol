// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {
    FHE,
    euint32,
    euint64,
    euint128
} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {
    InEuint32,
    InEuint64,
    InEuint128
} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

/// @title FhenixDropBox
/// @notice Privacy-first decentralized file sharing with on-chain access rules,
/// CoFHE encrypted rule mirrors, team folders, webhooks, subscriptions, relayed
/// anonymous uploads, previews, and batch download accounting.
contract FhenixDropBox is Ownable, ReentrancyGuard {
    uint256 private constant MAX_BATCH_SIZE = 10;
    uint256 private constant MAX_PRICE = 100 ether;
    uint8 private constant ROLE_VIEWER = 1;
    uint8 private constant ROLE_EDITOR = 2;
    uint8 private constant ROLE_ADMIN = 3;
    uint256 private constant MIN_SUBSCRIPTION_PERIOD = 1 hours;
    uint256 private constant MAX_SUBSCRIPTION_PERIODS = 52;

    struct File {
        string ipfsHash;
        string fileName;
        string mimeType;
        uint256 fileSize;
        uint256 createdAt;
        uint256 price;
        uint256 maxDownloads;
        uint256 downloadCount;
        uint256 expiresAt;
        bytes32 accessCodeHash;
        address owner;
        bool isActive;
        bool hasPassword;
        bool contentEncrypted;
        bytes32 encryptionKeyHash;
        uint256 folderId;
        bool previewEnabled;
        string previewHash;
        bool anonymousUpload;
    }

    struct UploadInput {
        string ipfsHash;
        string fileName;
        string mimeType;
        uint256 fileSize;
        uint256 price;
        uint256 maxDownloads;
        uint256 expiryDays;
        bytes32 accessCodeHash;
        bool contentEncrypted;
        bytes32 encryptionKeyHash;
        uint256 folderId;
        bool previewEnabled;
        string previewHash;
        bool anonymousUpload;
    }

    struct ConfidentialRuleInput {
        InEuint128 price;
        InEuint32 maxDownloads;
        InEuint64 expiresAt;
        InEuint128 accessCodeHashHigh;
        InEuint128 accessCodeHashLow;
        bool enabled;
    }

    struct ConfidentialRules {
        euint128 price;
        euint32 maxDownloads;
        euint64 expiresAt;
        euint128 accessCodeHashHigh;
        euint128 accessCodeHashLow;
        bool enabled;
        uint256 updatedAt;
    }

    struct Folder {
        uint256 id;
        address owner;
        string name;
        string color;
        uint256 createdAt;
        uint256 fileCount;
        bool isActive;
    }

    struct Webhook {
        uint256 id;
        address owner;
        bytes32 endpointHash;
        string label;
        uint8 eventMask;
        bool isActive;
        uint256 createdAt;
    }

    struct Team {
        uint256 id;
        address owner;
        string name;
        uint256 createdAt;
        uint256 memberCount;
        bool isActive;
    }

    struct FolderTeamPermission {
        uint256 teamId;
        uint8 minRole;
        bool isActive;
    }

    struct SubscriptionPlan {
        uint256 id;
        uint256 fileId;
        address owner;
        uint256 pricePerPeriod;
        uint256 periodSeconds;
        uint256 maxPeriods;
        bool isActive;
        uint256 createdAt;
    }

    struct Subscription {
        uint256 planId;
        uint256 paidUntil;
        uint256 periodsPaid;
        bool isActive;
    }

    mapping(uint256 => File) private files;
    mapping(address => uint256[]) private userFiles;
    mapping(uint256 => mapping(address => bool)) private authorizedUsers;
    mapping(uint256 => mapping(address => bool)) private downloadHistory;
    mapping(uint256 => mapping(address => uint256)) private subscriptionDownloadPaidUntil;
    mapping(uint256 => ConfidentialRules) private confidentialRules;
    mapping(uint256 => bool) private confidentialRulesEnabled;
    mapping(uint256 => bytes32) private anonymousOwnerCommitments;
    mapping(bytes32 => bool) private usedRelayerIntents;

    mapping(uint256 => Folder) public folders;
    mapping(address => uint256[]) private userFolders;
    mapping(uint256 => uint256[]) private folderFiles;
    mapping(uint256 => mapping(uint256 => uint256)) private folderFileIndexPlusOne;

    mapping(uint256 => Webhook) public webhooks;
    mapping(address => uint256[]) private userWebhooks;

    mapping(address => bool) public trustedRelayers;

    mapping(uint256 => Team) public teams;
    mapping(address => uint256[]) private userTeams;
    mapping(uint256 => address[]) private teamMemberList;
    mapping(uint256 => mapping(address => uint8)) private teamRoles;
    mapping(uint256 => FolderTeamPermission) private folderTeamPermissions;

    mapping(uint256 => SubscriptionPlan) public subscriptionPlans;
    mapping(uint256 => uint256[]) private fileSubscriptionPlans;
    mapping(uint256 => mapping(address => Subscription)) private subscriptions;

    uint256 public totalFiles;
    uint256 public totalDownloads;
    uint256 public totalVolume;
    uint256 public totalFolders;
    uint256 public totalWebhooks;
    uint256 public totalTeams;
    uint256 public totalSubscriptionPlans;

    event FileUploaded(
        uint256 indexed fileId,
        address indexed owner,
        string ipfsHash,
        string fileName,
        uint256 folderId,
        uint256 price,
        bool hasPassword,
        bool contentEncrypted,
        string previewHash,
        bool anonymousUpload
    );

    event FileAccessed(uint256 indexed fileId, address indexed requester, uint256 price);
    event FileDownloaded(uint256 indexed fileId, address indexed downloader, address indexed owner);
    event BatchDownloaded(address indexed downloader, uint256[] fileIds);
    event FileDeactivated(uint256 indexed fileId);
    event FileReactivated(uint256 indexed fileId);
    event FileRulesUpdated(uint256 indexed fileId, uint256 price, uint256 maxDownloads, uint256 expiresAt, bool hasPassword);
    event FileMetadataUpdated(uint256 indexed fileId, string fileName, string mimeType, uint256 folderId, string previewHash);
    event AccessRevoked(uint256 indexed fileId, address indexed user);
    event FolderCreated(uint256 indexed folderId, address indexed owner, string name, string color);
    event FolderUpdated(uint256 indexed folderId, string name, string color, bool isActive);
    event FileMoved(uint256 indexed fileId, uint256 indexed oldFolderId, uint256 indexed newFolderId);
    event FilePrivacyUpdated(uint256 indexed fileId, bool anonymousUpload);
    event WebhookRegistered(uint256 indexed webhookId, address indexed owner, bytes32 endpointHash, uint8 eventMask);
    event WebhookUpdated(uint256 indexed webhookId, bytes32 endpointHash, uint8 eventMask, bool isActive);
    event ConfidentialRulesUpdated(uint256 indexed fileId, bool enabled, bytes32 priceHandle, bytes32 maxDownloadsHandle, bytes32 expiresAtHandle);
    event TrustedRelayerUpdated(address indexed relayer, bool trusted);
    event RelayedUpload(address indexed relayer, uint256[] fileIds, bytes32 ownerCommitment, bytes32 intentHash);
    event TeamCreated(uint256 indexed teamId, address indexed owner, string name);
    event TeamMemberUpdated(uint256 indexed teamId, address indexed member, uint8 role, bool active);
    event FolderTeamPermissionUpdated(uint256 indexed folderId, uint256 indexed teamId, uint8 minRole, bool active);
    event SubscriptionPlanCreated(uint256 indexed planId, uint256 indexed fileId, uint256 pricePerPeriod, uint256 periodSeconds);
    event SubscriptionPlanUpdated(uint256 indexed planId, uint256 pricePerPeriod, uint256 periodSeconds, bool active);
    event SubscriptionPaid(uint256 indexed planId, uint256 indexed fileId, address indexed subscriber, uint256 paidUntil, uint256 periods);

    modifier fileExists(uint256 fileId) {
        require(files[fileId].owner != address(0));
        _;
    }

    modifier onlyFileOwner(uint256 fileId) {
        require(files[fileId].owner == msg.sender);
        _;
    }

    modifier folderExists(uint256 folderId) {
        require(folderId == 0 || folders[folderId].owner != address(0));
        _;
    }

    modifier onlyTrustedRelayer() {
        require(trustedRelayers[msg.sender]);
        _;
    }

    modifier onlyTeamAdmin(uint256 teamId) {
        require(teams[teamId].owner == msg.sender || teamRoles[teamId][msg.sender] >= ROLE_ADMIN);
        _;
    }

    constructor() Ownable(msg.sender) {}

    /// @notice Backward-compatible upload entrypoint used by earlier app versions.
    function uploadFile(
        string calldata ipfsHash_,
        uint256 price_,
        uint256 maxDownloads_,
        uint256 expiryDays_,
        bytes32 accessCodeHash_,
        bool contentEncrypted_,
        bytes32 encryptionKeyHash_
    ) external returns (uint256 fileId) {
        UploadInput memory input = UploadInput({
            ipfsHash: ipfsHash_,
            fileName: "",
            mimeType: "",
            fileSize: 0,
            price: price_,
            maxDownloads: maxDownloads_,
            expiryDays: expiryDays_,
            accessCodeHash: accessCodeHash_,
            contentEncrypted: contentEncrypted_,
            encryptionKeyHash: encryptionKeyHash_,
            folderId: 0,
            previewEnabled: false,
            previewHash: "",
            anonymousUpload: false
        });

        return _uploadFile(input, msg.sender);
    }

    /// @notice Upload one file with Wave 3/4 metadata.
    function uploadFileDetailed(UploadInput calldata input) external returns (uint256 fileId) {
        UploadInput memory copied = input;
        return _uploadFile(copied, msg.sender);
    }

    /// @notice Upload up to 10 files in a single transaction.
    function uploadFilesBatch(UploadInput[] calldata inputs) external returns (uint256[] memory fileIds) {
        require(inputs.length > 0);
        require(inputs.length <= MAX_BATCH_SIZE);

        fileIds = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            UploadInput memory copied = inputs[i];
            fileIds[i] = _uploadFile(copied, msg.sender);
        }
    }

    /// @notice Upload files and store CoFHE encrypted mirrors of the access rules.
    /// @dev Public rule fields still enforce access today; encrypted handles give
    /// Fhenix-compatible confidential storage for analytics/decrypt views.
    function uploadFilesBatchWithConfidentialRules(
        UploadInput[] calldata inputs,
        ConfidentialRuleInput[] calldata encryptedRules
    ) external returns (uint256[] memory fileIds) {
        require(inputs.length > 0);
        require(inputs.length <= MAX_BATCH_SIZE);
        require(inputs.length == encryptedRules.length);

        fileIds = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            UploadInput memory copied = inputs[i];
            fileIds[i] = _uploadFile(copied, msg.sender);
            _setConfidentialRules(fileIds[i], encryptedRules[i]);
        }
    }

    /// @notice Relayer entrypoint for stronger anonymous uploads.
    /// @dev The trusted relayer pays gas; owner lookups can still be hidden by
    /// anonymous mode while `logicalOwner` keeps recovery/control possible.
    function relayedUploadFilesBatch(
        UploadInput[] calldata inputs,
        address logicalOwner,
        bytes32 ownerCommitment,
        bytes32 intentHash
    ) external onlyTrustedRelayer returns (uint256[] memory fileIds) {
        require(logicalOwner != address(0));
        require(intentHash != bytes32(0));
        require(!usedRelayerIntents[intentHash]);
        require(inputs.length > 0);
        require(inputs.length <= MAX_BATCH_SIZE);

        usedRelayerIntents[intentHash] = true;
        fileIds = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            UploadInput memory copied = inputs[i];
            copied.anonymousUpload = true;
            fileIds[i] = _uploadFile(copied, logicalOwner);
            anonymousOwnerCommitments[fileIds[i]] = ownerCommitment;
        }

        emit RelayedUpload(msg.sender, fileIds, ownerCommitment, intentHash);
    }

    function _uploadFile(UploadInput memory input, address owner_) internal returns (uint256 fileId) {
        require(owner_ != address(0));
        require(bytes(input.ipfsHash).length > 0);
        require(input.price <= MAX_PRICE);
        _requireWritableFolder(input.folderId, owner_);

        fileId = totalFiles++;
        uint256 expiresAt = input.expiryDays > 0 ? block.timestamp + (input.expiryDays * 1 days) : 0;
        bool hasPassword = input.accessCodeHash != bytes32(0);

        files[fileId] = File({
            ipfsHash: input.ipfsHash,
            fileName: input.fileName,
            mimeType: input.mimeType,
            fileSize: input.fileSize,
            createdAt: block.timestamp,
            price: input.price,
            maxDownloads: input.maxDownloads,
            downloadCount: 0,
            expiresAt: expiresAt,
            accessCodeHash: input.accessCodeHash,
            owner: owner_,
            isActive: true,
            hasPassword: hasPassword,
            contentEncrypted: input.contentEncrypted,
            encryptionKeyHash: input.encryptionKeyHash,
            folderId: input.folderId,
            previewEnabled: input.previewEnabled && bytes(input.previewHash).length > 0,
            previewHash: input.previewHash,
            anonymousUpload: input.anonymousUpload
        });

        userFiles[owner_].push(fileId);
        _addFileToFolderIndex(input.folderId, fileId);
        if (input.folderId != 0) {
            folders[input.folderId].fileCount++;
        }

        address visibleOwner = input.anonymousUpload ? address(0) : owner_;
        emit FileUploaded(
            fileId,
            visibleOwner,
            input.ipfsHash,
            input.fileName,
            input.folderId,
            input.price,
            hasPassword,
            input.contentEncrypted,
            input.previewHash,
            input.anonymousUpload
        );
    }

    function setConfidentialRules(
        uint256 fileId,
        ConfidentialRuleInput calldata encryptedRules
    ) external fileExists(fileId) onlyFileOwner(fileId) {
        _setConfidentialRules(fileId, encryptedRules);
    }

    function clearConfidentialRules(uint256 fileId) external fileExists(fileId) onlyFileOwner(fileId) {
        delete confidentialRules[fileId];
        confidentialRulesEnabled[fileId] = false;
        emit ConfidentialRulesUpdated(fileId, false, bytes32(0), bytes32(0), bytes32(0));
    }

    function _setConfidentialRules(
        uint256 fileId,
        ConfidentialRuleInput calldata encryptedRules
    ) internal {
        if (!encryptedRules.enabled) {
            delete confidentialRules[fileId];
            confidentialRulesEnabled[fileId] = false;
            emit ConfidentialRulesUpdated(fileId, false, bytes32(0), bytes32(0), bytes32(0));
            return;
        }

        euint128 encryptedPrice = FHE.asEuint128(encryptedRules.price);
        euint32 encryptedMaxDownloads = FHE.asEuint32(encryptedRules.maxDownloads);
        euint64 encryptedExpiresAt = FHE.asEuint64(encryptedRules.expiresAt);
        euint128 encryptedAccessHigh = FHE.asEuint128(encryptedRules.accessCodeHashHigh);
        euint128 encryptedAccessLow = FHE.asEuint128(encryptedRules.accessCodeHashLow);

        FHE.allowThis(encryptedPrice);
        FHE.allowThis(encryptedMaxDownloads);
        FHE.allowThis(encryptedExpiresAt);
        FHE.allowThis(encryptedAccessHigh);
        FHE.allowThis(encryptedAccessLow);
        FHE.allowSender(encryptedPrice);
        FHE.allowSender(encryptedMaxDownloads);
        FHE.allowSender(encryptedExpiresAt);
        FHE.allowSender(encryptedAccessHigh);
        FHE.allowSender(encryptedAccessLow);

        confidentialRules[fileId] = ConfidentialRules({
            price: encryptedPrice,
            maxDownloads: encryptedMaxDownloads,
            expiresAt: encryptedExpiresAt,
            accessCodeHashHigh: encryptedAccessHigh,
            accessCodeHashLow: encryptedAccessLow,
            enabled: true,
            updatedAt: block.timestamp
        });
        confidentialRulesEnabled[fileId] = true;

        emit ConfidentialRulesUpdated(
            fileId,
            true,
            euint128.unwrap(encryptedPrice),
            euint32.unwrap(encryptedMaxDownloads),
            euint64.unwrap(encryptedExpiresAt)
        );
    }

    /// @notice Request access to a file using native testnet ETH.
    function requestAccess(uint256 fileId, bytes32 accessCode_) external payable fileExists(fileId) nonReentrant {
        File storage file = files[fileId];
        _requireAvailable(fileId);

        if (file.hasPassword) {
            require(file.accessCodeHash == accessCode_);
        }

        if (msg.sender != file.owner && file.price > 0) {
            require(msg.value >= file.price);
            totalVolume += file.price;

            (bool paid, ) = file.owner.call{value: file.price}("");
            require(paid);

            if (msg.value > file.price) {
                (bool refunded, ) = msg.sender.call{value: msg.value - file.price}("");
                require(refunded);
            }
        } else if (msg.value > 0) {
            (bool refundedFreeAccess, ) = msg.sender.call{value: msg.value}("");
            require(refundedFreeAccess);
        }

        authorizedUsers[fileId][msg.sender] = true;
        emit FileAccessed(fileId, msg.sender, file.price);
    }

    /// @notice Record a single download after access is granted.
    function downloadFile(uint256 fileId) external fileExists(fileId) nonReentrant {
        _recordDownload(fileId, msg.sender);
    }

    /// @notice Record multiple downloads in one transaction.
    function batchDownloadFiles(uint256[] calldata fileIds) external nonReentrant {
        require(fileIds.length > 0);
        require(fileIds.length <= MAX_BATCH_SIZE);

        for (uint256 i = 0; i < fileIds.length; i++) {
            require(files[fileIds[i]].owner != address(0));
            _recordDownload(fileIds[i], msg.sender);
        }

        emit BatchDownloaded(msg.sender, fileIds);
    }

    function _recordDownload(uint256 fileId, address downloader) internal {
        File storage file = files[fileId];
        _requireAvailable(fileId);
        uint256 subscriptionPaidUntil = activeSubscriptionPaidUntil(fileId, downloader);
        bool subscriptionAccess = subscriptionPaidUntil >= block.timestamp && subscriptionPaidUntil != 0;
        bool subscriptionWindowUnused =
            subscriptionAccess && subscriptionDownloadPaidUntil[fileId][downloader] < subscriptionPaidUntil;
        require(
            file.owner == downloader ||
                authorizedUsers[fileId][downloader] ||
                subscriptionAccess ||
                canViewFolder(file.folderId, downloader)
        );
        require(!downloadHistory[fileId][downloader] || subscriptionWindowUnused);

        file.downloadCount++;
        totalDownloads++;
        downloadHistory[fileId][downloader] = true;
        if (subscriptionWindowUnused) {
            subscriptionDownloadPaidUntil[fileId][downloader] = subscriptionPaidUntil;
        }

        emit FileDownloaded(fileId, downloader, file.anonymousUpload ? address(0) : file.owner);
    }

    function createFolder(string calldata name, string calldata color) external returns (uint256 folderId) {
        require(bytes(name).length > 0);

        folderId = ++totalFolders;
        folders[folderId] = Folder({
            id: folderId,
            owner: msg.sender,
            name: name,
            color: color,
            createdAt: block.timestamp,
            fileCount: 0,
            isActive: true
        });
        userFolders[msg.sender].push(folderId);

        emit FolderCreated(folderId, msg.sender, name, color);
    }

    function updateFolder(uint256 folderId, string calldata name, string calldata color, bool isActive) external folderExists(folderId) {
        require(folderId != 0);
        Folder storage folder = folders[folderId];
        require(folder.owner == msg.sender);
        require(bytes(name).length > 0);

        folder.name = name;
        folder.color = color;
        folder.isActive = isActive;

        emit FolderUpdated(folderId, name, color, isActive);
    }

    function moveFileToFolder(uint256 fileId, uint256 folderId) external fileExists(fileId) onlyFileOwner(fileId) {
        _requireWritableFolder(folderId, msg.sender);

        uint256 oldFolderId = files[fileId].folderId;
        if (oldFolderId == folderId) return;

        if (oldFolderId != 0 && folders[oldFolderId].fileCount > 0) {
            folders[oldFolderId].fileCount--;
        }
        if (folderId != 0) {
            folders[folderId].fileCount++;
        }

        _removeFileFromFolderIndex(oldFolderId, fileId);
        _addFileToFolderIndex(folderId, fileId);
        files[fileId].folderId = folderId;
        emit FileMoved(fileId, oldFolderId, folderId);
    }

    function createTeam(string calldata name) external returns (uint256 teamId) {
        require(bytes(name).length > 0);

        teamId = ++totalTeams;
        teams[teamId] = Team({
            id: teamId,
            owner: msg.sender,
            name: name,
            createdAt: block.timestamp,
            memberCount: 1,
            isActive: true
        });
        teamRoles[teamId][msg.sender] = ROLE_ADMIN;
        teamMemberList[teamId].push(msg.sender);
        userTeams[msg.sender].push(teamId);

        emit TeamCreated(teamId, msg.sender, name);
        emit TeamMemberUpdated(teamId, msg.sender, ROLE_ADMIN, true);
    }

    function updateTeam(uint256 teamId, string calldata name, bool isActive) external onlyTeamAdmin(teamId) {
        require(bytes(name).length > 0);
        Team storage team = teams[teamId];
        require(team.owner != address(0));

        team.name = name;
        team.isActive = isActive;
    }

    function addTeamMember(uint256 teamId, address member, uint8 role) external onlyTeamAdmin(teamId) {
        require(member != address(0));
        require(role >= ROLE_VIEWER && role <= ROLE_ADMIN);
        Team storage team = teams[teamId];
        require(team.isActive);
        require(member != team.owner || role == ROLE_ADMIN);

        if (teamRoles[teamId][member] == 0) {
            team.memberCount++;
            teamMemberList[teamId].push(member);
            _addTeamToUser(member, teamId);
        }

        teamRoles[teamId][member] = role;
        emit TeamMemberUpdated(teamId, member, role, true);
    }

    function removeTeamMember(uint256 teamId, address member) external onlyTeamAdmin(teamId) {
        require(member != teams[teamId].owner);
        require(teamRoles[teamId][member] != 0);

        teamRoles[teamId][member] = 0;
        _removeTeamFromUser(member, teamId);
        _removeTeamMemberList(teamId, member);
        if (teams[teamId].memberCount > 0) {
            teams[teamId].memberCount--;
        }

        emit TeamMemberUpdated(teamId, member, 0, false);
    }

    function grantFolderToTeam(uint256 folderId, uint256 teamId, uint8 minRole) external folderExists(folderId) onlyTeamAdmin(teamId) {
        require(folderId != 0);
        require(folders[folderId].owner == msg.sender);
        require(teams[teamId].isActive);
        require(minRole >= ROLE_VIEWER && minRole <= ROLE_ADMIN);

        folderTeamPermissions[folderId] = FolderTeamPermission({
            teamId: teamId,
            minRole: minRole,
            isActive: true
        });

        emit FolderTeamPermissionUpdated(folderId, teamId, minRole, true);
    }

    function revokeFolderTeam(uint256 folderId) external folderExists(folderId) {
        require(folderId != 0);
        require(folders[folderId].owner == msg.sender);

        FolderTeamPermission memory permission = folderTeamPermissions[folderId];
        delete folderTeamPermissions[folderId];

        emit FolderTeamPermissionUpdated(folderId, permission.teamId, permission.minRole, false);
    }

    function registerWebhook(
        bytes32 endpointHash,
        string calldata label,
        uint8 eventMask
    ) external returns (uint256 webhookId) {
        require(endpointHash != bytes32(0));
        require(eventMask > 0);

        webhookId = ++totalWebhooks;
        webhooks[webhookId] = Webhook({
            id: webhookId,
            owner: msg.sender,
            endpointHash: endpointHash,
            label: label,
            eventMask: eventMask,
            isActive: true,
            createdAt: block.timestamp
        });
        userWebhooks[msg.sender].push(webhookId);

        emit WebhookRegistered(webhookId, msg.sender, endpointHash, eventMask);
    }

    function updateWebhook(
        uint256 webhookId,
        bytes32 endpointHash,
        string calldata label,
        uint8 eventMask,
        bool isActive
    ) external {
        Webhook storage hook = webhooks[webhookId];
        require(hook.owner == msg.sender);
        require(endpointHash != bytes32(0));
        require(eventMask > 0);

        hook.endpointHash = endpointHash;
        hook.label = label;
        hook.eventMask = eventMask;
        hook.isActive = isActive;

        emit WebhookUpdated(webhookId, endpointHash, eventMask, isActive);
    }

    function setTrustedRelayer(address relayer, bool trusted) external onlyOwner {
        require(relayer != address(0));
        trustedRelayers[relayer] = trusted;
        emit TrustedRelayerUpdated(relayer, trusted);
    }

    function createSubscriptionPlan(
        uint256 fileId,
        uint256 pricePerPeriod,
        uint256 periodSeconds,
        uint256 maxPeriods
    ) external fileExists(fileId) onlyFileOwner(fileId) returns (uint256 planId) {
        require(pricePerPeriod <= MAX_PRICE);
        require(periodSeconds >= MIN_SUBSCRIPTION_PERIOD);
        require(maxPeriods == 0 || maxPeriods <= MAX_SUBSCRIPTION_PERIODS);

        planId = ++totalSubscriptionPlans;
        subscriptionPlans[planId] = SubscriptionPlan({
            id: planId,
            fileId: fileId,
            owner: msg.sender,
            pricePerPeriod: pricePerPeriod,
            periodSeconds: periodSeconds,
            maxPeriods: maxPeriods,
            isActive: true,
            createdAt: block.timestamp
        });
        fileSubscriptionPlans[fileId].push(planId);

        emit SubscriptionPlanCreated(planId, fileId, pricePerPeriod, periodSeconds);
    }

    function updateSubscriptionPlan(
        uint256 planId,
        uint256 pricePerPeriod,
        uint256 periodSeconds,
        uint256 maxPeriods,
        bool isActive
    ) external {
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        require(plan.owner == msg.sender);
        require(pricePerPeriod <= MAX_PRICE);
        require(periodSeconds >= MIN_SUBSCRIPTION_PERIOD);
        require(maxPeriods == 0 || maxPeriods <= MAX_SUBSCRIPTION_PERIODS);

        plan.pricePerPeriod = pricePerPeriod;
        plan.periodSeconds = periodSeconds;
        plan.maxPeriods = maxPeriods;
        plan.isActive = isActive;

        emit SubscriptionPlanUpdated(planId, pricePerPeriod, periodSeconds, isActive);
    }

    function subscribeToPlan(uint256 planId, uint256 periods, bytes32 accessCode_) external payable nonReentrant {
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        require(plan.owner != address(0));
        require(plan.isActive);
        _requireAvailable(plan.fileId);
        require(periods > 0);
        require(periods <= MAX_SUBSCRIPTION_PERIODS);

        File storage file = files[plan.fileId];
        if (file.hasPassword) {
            require(file.accessCodeHash == accessCode_);
        }

        Subscription storage current = subscriptions[planId][msg.sender];
        if (plan.maxPeriods > 0) {
            require(current.periodsPaid + periods <= plan.maxPeriods);
        }

        uint256 amountDue = plan.pricePerPeriod * periods;
        if (msg.sender != plan.owner && amountDue > 0) {
            require(msg.value >= amountDue);
            totalVolume += amountDue;

            (bool paid, ) = plan.owner.call{value: amountDue}("");
            require(paid);

            if (msg.value > amountDue) {
                (bool refunded, ) = msg.sender.call{value: msg.value - amountDue}("");
                require(refunded);
            }
        } else if (msg.value > 0) {
            (bool refundedFreeAccess, ) = msg.sender.call{value: msg.value}("");
            require(refundedFreeAccess);
        }

        uint256 startsAt = current.paidUntil > block.timestamp ? current.paidUntil : block.timestamp;
        current.planId = planId;
        current.paidUntil = startsAt + (plan.periodSeconds * periods);
        current.periodsPaid += periods;
        current.isActive = true;

        emit SubscriptionPaid(planId, plan.fileId, msg.sender, current.paidUntil, periods);
    }

    function cancelSubscription(uint256 planId) external {
        Subscription storage current = subscriptions[planId][msg.sender];
        require(current.isActive);
        current.isActive = false;
    }

    function getFileInfo(uint256 fileId) external view fileExists(fileId) returns (
        string memory ipfsHash,
        uint256 createdAt,
        uint256 price,
        uint256 maxDownloads,
        uint256 downloadCount,
        bool isActive,
        bool hasPassword,
        bool contentEncrypted
    ) {
        File storage f = files[fileId];
        return (
            f.ipfsHash,
            f.createdAt,
            f.price,
            f.maxDownloads,
            f.downloadCount,
            f.isActive,
            f.hasPassword,
            f.contentEncrypted
        );
    }

    function getFileMetadata(uint256 fileId) external view fileExists(fileId) returns (
        string memory fileName,
        string memory mimeType,
        uint256 fileSize,
        uint256 expiresAt,
        uint256 folderId,
        bool previewEnabled,
        string memory previewHash
    ) {
        File storage f = files[fileId];
        return (f.fileName, f.mimeType, f.fileSize, f.expiresAt, f.folderId, f.previewEnabled, f.previewHash);
    }

    function getFileExpiry(uint256 fileId) external view fileExists(fileId) returns (uint256) {
        return files[fileId].expiresAt;
    }

    function getAccessInfo(uint256 fileId) external view fileExists(fileId) returns (
        bool isAuthorized,
        bool hasDownloaded
    ) {
        File storage file = files[fileId];
        uint256 subscriptionPaidUntil = activeSubscriptionPaidUntil(fileId, msg.sender);
        bool subscriptionAccess = subscriptionPaidUntil >= block.timestamp && subscriptionPaidUntil != 0;
        bool alreadyDownloaded = downloadHistory[fileId][msg.sender];
        bool currentSubscriptionConsumed =
            subscriptionAccess && subscriptionDownloadPaidUntil[fileId][msg.sender] >= subscriptionPaidUntil;
        return (
            file.owner == msg.sender ||
                authorizedUsers[fileId][msg.sender] ||
                subscriptionAccess ||
                canViewFolder(file.folderId, msg.sender),
            alreadyDownloaded && (!subscriptionAccess || currentSubscriptionConsumed)
        );
    }

    function getEncryptionInfo(uint256 fileId) external view fileExists(fileId) returns (
        bool contentEncrypted,
        bool isOwnerOrAuthorized
    ) {
        File storage file = files[fileId];
        bool allowed = file.owner == msg.sender ||
            authorizedUsers[fileId][msg.sender] ||
            activeSubscriptionPaidUntil(fileId, msg.sender) >= block.timestamp ||
            canViewFolder(file.folderId, msg.sender);
        return (files[fileId].contentEncrypted, allowed);
    }

    function getFileOwner(uint256 fileId) external view fileExists(fileId) returns (address) {
        if (files[fileId].anonymousUpload) return address(0);
        return files[fileId].owner;
    }

    function getWebhookFileOwner(uint256 fileId) external view fileExists(fileId) returns (address) {
        require(msg.sender == owner() || trustedRelayers[msg.sender]);
        return files[fileId].owner;
    }

    function getFilePrivacy(uint256 fileId) external view fileExists(fileId) returns (
        bool anonymousUpload,
        address visibleOwner
    ) {
        File storage f = files[fileId];
        return (f.anonymousUpload, f.anonymousUpload ? address(0) : f.owner);
    }

    function getConfidentialRuleHandles(uint256 fileId) external view fileExists(fileId) returns (
        bool enabled,
        bytes32 priceHandle,
        bytes32 maxDownloadsHandle,
        bytes32 expiresAtHandle,
        bytes32 accessCodeHashHighHandle,
        bytes32 accessCodeHashLowHandle,
        uint256 updatedAt
    ) {
        ConfidentialRules storage rules = confidentialRules[fileId];
        if (!rules.enabled) {
            return (false, bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0), 0);
        }

        return (
            true,
            euint128.unwrap(rules.price),
            euint32.unwrap(rules.maxDownloads),
            euint64.unwrap(rules.expiresAt),
            euint128.unwrap(rules.accessCodeHashHigh),
            euint128.unwrap(rules.accessCodeHashLow),
            rules.updatedAt
        );
    }

    function getMyFiles() external view returns (uint256[] memory) {
        return userFiles[msg.sender];
    }

    function getMyFolders() external view returns (uint256[] memory) {
        return userFolders[msg.sender];
    }

    function getMyWebhooks() external view returns (uint256[] memory) {
        return userWebhooks[msg.sender];
    }

    function getMyTeams() external view returns (uint256[] memory) {
        return userTeams[msg.sender];
    }

    function getTeamMembers(uint256 teamId) external view returns (address[] memory) {
        return teamMemberList[teamId];
    }

    function getFileSubscriptionPlans(uint256 fileId) external view fileExists(fileId) returns (uint256[] memory) {
        return fileSubscriptionPlans[fileId];
    }

    function getFilesByFolder(uint256 folderId) external view returns (uint256[] memory fileIds) {
        uint256[] storage indexedFiles = folderFiles[folderId];
        uint256 count;

        for (uint256 i = 0; i < indexedFiles.length; i++) {
            if (files[indexedFiles[i]].owner == msg.sender) count++;
        }

        fileIds = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 0; i < indexedFiles.length; i++) {
            if (files[indexedFiles[i]].owner == msg.sender) {
                fileIds[cursor++] = indexedFiles[i];
            }
        }
    }

    function getVisibleFilesByFolder(uint256 folderId) external view returns (uint256[] memory fileIds) {
        require(folderId == 0 || folders[folderId].owner != address(0));
        uint256[] storage indexedFiles = folderFiles[folderId];
        bool folderViewer = folderId != 0 && canViewFolder(folderId, msg.sender);
        uint256 count;

        for (uint256 i = 0; i < indexedFiles.length; i++) {
            File storage file = files[indexedFiles[i]];
            if (file.owner != address(0) && (file.owner == msg.sender || folderViewer)) {
                count++;
            }
        }

        fileIds = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 0; i < indexedFiles.length; i++) {
            File storage file = files[indexedFiles[i]];
            if (file.owner != address(0) && (file.owner == msg.sender || folderViewer)) {
                fileIds[cursor++] = indexedFiles[i];
            }
        }
    }

    function getVisibleFolders() external view returns (uint256[] memory folderIds) {
        uint256 count;
        for (uint256 i = 1; i <= totalFolders; i++) {
            if (folders[i].isActive && canViewFolder(i, msg.sender)) count++;
        }

        folderIds = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 1; i <= totalFolders; i++) {
            if (folders[i].isActive && canViewFolder(i, msg.sender)) {
                folderIds[cursor++] = i;
            }
        }
    }

    function deactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = false;
        emit FileDeactivated(fileId);
    }

    function reactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = true;
        emit FileReactivated(fileId);
    }

    function updateFileRules(
        uint256 fileId,
        uint256 newPrice,
        uint256 newMaxDownloads,
        uint256 newExpiryDays,
        bytes32 newAccessCodeHash
    ) external onlyFileOwner(fileId) {
        require(newPrice <= MAX_PRICE);

        File storage file = files[fileId];
        file.price = newPrice;
        file.maxDownloads = newMaxDownloads;
        file.expiresAt = newExpiryDays > 0 ? block.timestamp + (newExpiryDays * 1 days) : 0;
        file.accessCodeHash = newAccessCodeHash;
        file.hasPassword = newAccessCodeHash != bytes32(0);
        if (confidentialRulesEnabled[fileId]) {
            delete confidentialRules[fileId];
            confidentialRulesEnabled[fileId] = false;
            emit ConfidentialRulesUpdated(fileId, false, bytes32(0), bytes32(0), bytes32(0));
        }

        emit FileRulesUpdated(fileId, newPrice, newMaxDownloads, file.expiresAt, file.hasPassword);
    }

    function updateFileMetadata(
        uint256 fileId,
        string calldata fileName,
        string calldata mimeType,
        uint256 fileSize,
        bool previewEnabled,
        string calldata previewHash
    ) external onlyFileOwner(fileId) {
        File storage file = files[fileId];
        file.fileName = fileName;
        file.mimeType = mimeType;
        file.fileSize = fileSize;
        file.previewEnabled = previewEnabled && bytes(previewHash).length > 0;
        file.previewHash = previewHash;

        emit FileMetadataUpdated(fileId, fileName, mimeType, file.folderId, previewHash);
    }

    function updateFilePrivacy(uint256 fileId, bool anonymousUpload) external onlyFileOwner(fileId) {
        files[fileId].anonymousUpload = anonymousUpload;
        emit FilePrivacyUpdated(fileId, anonymousUpload);
    }

    function revokeAccess(uint256 fileId, address user) external onlyFileOwner(fileId) {
        authorizedUsers[fileId][user] = false;
        emit AccessRevoked(fileId, user);
    }

    function getStats() external view returns (
        uint256 _totalFiles,
        uint256 _totalDownloads,
        uint256 _totalVolume,
        uint256 _myFileCount
    ) {
        return (totalFiles, totalDownloads, totalVolume, userFiles[msg.sender].length);
    }

    function getProductionStats() external view returns (
        uint256 _totalFiles,
        uint256 _totalDownloads,
        uint256 _totalVolume,
        uint256 _totalFolders,
        uint256 _totalWebhooks,
        uint256 _totalTeams,
        uint256 _totalSubscriptionPlans
    ) {
        return (
            totalFiles,
            totalDownloads,
            totalVolume,
            totalFolders,
            totalWebhooks,
            totalTeams,
            totalSubscriptionPlans
        );
    }

    function getFileAnalytics(uint256 fileId) external view fileExists(fileId) returns (
        uint256 downloads,
        uint256 remainingDownloads,
        uint256 price,
        uint256 expiresAt,
        bool active,
        bool confidentialRulesActive,
        uint256 subscriptionPlanCount
    ) {
        File storage f = files[fileId];
        return (
            f.downloadCount,
            getRemainingDownloads(fileId),
            f.price,
            f.expiresAt,
            f.isActive,
            confidentialRulesEnabled[fileId],
            fileSubscriptionPlans[fileId].length
        );
    }

    function getRemainingDownloads(uint256 fileId) public view fileExists(fileId) returns (uint256) {
        File storage f = files[fileId];
        if (f.maxDownloads == 0) return type(uint256).max;
        if (f.downloadCount >= f.maxDownloads) return 0;
        return f.maxDownloads - f.downloadCount;
    }

    function hasActiveSubscription(uint256 fileId, address subscriber) public view fileExists(fileId) returns (bool) {
        return activeSubscriptionPaidUntil(fileId, subscriber) >= block.timestamp;
    }

    function activeSubscriptionPaidUntil(
        uint256 fileId,
        address subscriber
    ) public view fileExists(fileId) returns (uint256 paidUntil) {
        uint256[] storage planIds = fileSubscriptionPlans[fileId];
        for (uint256 i = 0; i < planIds.length; i++) {
            Subscription storage current = subscriptions[planIds[i]][subscriber];
            if (current.isActive && current.paidUntil >= block.timestamp && current.paidUntil > paidUntil) {
                paidUntil = current.paidUntil;
            }
        }
    }

    function canViewFolder(uint256 folderId, address account) public view returns (bool) {
        if (folderId == 0) return false;
        Folder storage folder = folders[folderId];
        if (!folder.isActive) return false;
        if (folder.owner == account) return true;

        FolderTeamPermission storage permission = folderTeamPermissions[folderId];
        if (!permission.isActive) return false;
        Team storage team = teams[permission.teamId];
        if (!team.isActive) return false;
        return teamRoles[permission.teamId][account] >= permission.minRole;
    }

    function canWriteFolder(uint256 folderId, address account) public view returns (bool) {
        if (folderId == 0) return true;
        Folder storage folder = folders[folderId];
        if (!folder.isActive) return false;
        if (folder.owner == account) return true;

        FolderTeamPermission storage permission = folderTeamPermissions[folderId];
        if (!permission.isActive) return false;
        Team storage team = teams[permission.teamId];
        if (!team.isActive) return false;

        uint8 requiredRole = permission.minRole > ROLE_EDITOR ? permission.minRole : ROLE_EDITOR;
        return teamRoles[permission.teamId][account] >= requiredRole;
    }

    function isFileExpired(uint256 fileId) public view fileExists(fileId) returns (bool) {
        uint256 exp = files[fileId].expiresAt;
        return exp > 0 && block.timestamp >= exp;
    }

    function getLatestFileId() external view returns (uint256) {
        uint256[] storage myFileIds = userFiles[msg.sender];
        require(myFileIds.length > 0);
        return myFileIds[myFileIds.length - 1];
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function withdrawERC20(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(owner(), balance));
    }

    function _requireAvailable(uint256 fileId) internal view {
        File storage file = files[fileId];
        require(file.isActive);
        require(!isFileExpired(fileId));
        if (file.maxDownloads > 0) {
            require(file.downloadCount < file.maxDownloads);
        }
    }

    function _requireWritableFolder(uint256 folderId, address owner_) internal view {
        if (folderId == 0) return;
        require(folders[folderId].isActive);
        require(canWriteFolder(folderId, owner_));
    }

    function _addFileToFolderIndex(uint256 folderId, uint256 fileId) internal {
        if (folderFileIndexPlusOne[folderId][fileId] != 0) return;
        folderFileIndexPlusOne[folderId][fileId] = folderFiles[folderId].length + 1;
        folderFiles[folderId].push(fileId);
    }

    function _removeFileFromFolderIndex(uint256 folderId, uint256 fileId) internal {
        uint256 indexPlusOne = folderFileIndexPlusOne[folderId][fileId];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256[] storage indexedFiles = folderFiles[folderId];
        uint256 lastFileId = indexedFiles[indexedFiles.length - 1];

        indexedFiles[index] = lastFileId;
        folderFileIndexPlusOne[folderId][lastFileId] = indexPlusOne;
        indexedFiles.pop();
        delete folderFileIndexPlusOne[folderId][fileId];
    }

    function _addTeamToUser(address user, uint256 teamId) internal {
        uint256[] storage teamsForUser = userTeams[user];
        for (uint256 i = 0; i < teamsForUser.length; i++) {
            if (teamsForUser[i] == teamId) return;
        }
        teamsForUser.push(teamId);
    }

    function _removeTeamFromUser(address user, uint256 teamId) internal {
        uint256[] storage teamsForUser = userTeams[user];
        for (uint256 i = 0; i < teamsForUser.length; i++) {
            if (teamsForUser[i] == teamId) {
                teamsForUser[i] = teamsForUser[teamsForUser.length - 1];
                teamsForUser.pop();
                return;
            }
        }
    }

    function _removeTeamMemberList(uint256 teamId, address member) internal {
        address[] storage members = teamMemberList[teamId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == member) {
                members[i] = members[members.length - 1];
                members.pop();
                return;
            }
        }
    }
}
