// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FhenixDropBox
/// @notice Privacy-first decentralized file sharing with on-chain access rules,
/// folders, webhook registration, previews, and batch download accounting.
/// @dev The current production path uses native testnet ETH for access payments.
/// CoFHE/FHE encrypted rule storage should be added with the Fhenix cofhe-contracts package
/// when the app moves from public testnet payments to confidential payment rails.
contract FhenixDropBox is Ownable, ReentrancyGuard {
    uint256 public constant MAX_BATCH_SIZE = 10;
    uint256 public constant MAX_PRICE = 100 ether;

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

    mapping(uint256 => File) public files;
    mapping(address => uint256[]) public userFiles;
    mapping(uint256 => mapping(address => bool)) public authorizedUsers;
    mapping(uint256 => mapping(address => bool)) public downloadHistory;

    mapping(uint256 => Folder) public folders;
    mapping(address => uint256[]) public userFolders;

    mapping(uint256 => Webhook) public webhooks;
    mapping(address => uint256[]) public userWebhooks;

    uint256 public totalFiles;
    uint256 public totalDownloads;
    uint256 public totalVolume;
    uint256 public totalFolders;
    uint256 public totalWebhooks;

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

    modifier fileExists(uint256 fileId) {
        require(files[fileId].owner != address(0), "File does not exist");
        _;
    }

    modifier onlyFileOwner(uint256 fileId) {
        require(files[fileId].owner == msg.sender, "Not file owner");
        _;
    }

    modifier folderExists(uint256 folderId) {
        require(folderId == 0 || folders[folderId].owner != address(0), "Folder does not exist");
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
        require(inputs.length > 0, "No files");
        require(inputs.length <= MAX_BATCH_SIZE, "Too many files");

        fileIds = new uint256[](inputs.length);
        for (uint256 i = 0; i < inputs.length; i++) {
            UploadInput memory copied = inputs[i];
            fileIds[i] = _uploadFile(copied, msg.sender);
        }
    }

    function _uploadFile(UploadInput memory input, address owner_) internal returns (uint256 fileId) {
        require(bytes(input.ipfsHash).length > 0, "IPFS hash required");
        require(input.price <= MAX_PRICE, "Price too high");
        _requireOwnedFolder(input.folderId, owner_);

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

    /// @notice Request access to a file using native testnet ETH.
    function requestAccess(uint256 fileId, bytes32 accessCode_) external payable fileExists(fileId) nonReentrant {
        File storage file = files[fileId];
        _requireAvailable(fileId);

        if (file.hasPassword) {
            require(file.accessCodeHash == accessCode_, "Invalid access code");
        }

        if (msg.sender != file.owner && file.price > 0) {
            require(msg.value >= file.price, "Insufficient payment");
            totalVolume += file.price;

            (bool paid, ) = file.owner.call{value: file.price}("");
            require(paid, "Payment transfer failed");

            if (msg.value > file.price) {
                (bool refunded, ) = msg.sender.call{value: msg.value - file.price}("");
                require(refunded, "Refund failed");
            }
        } else if (msg.value > 0) {
            (bool refundedFreeAccess, ) = msg.sender.call{value: msg.value}("");
            require(refundedFreeAccess, "Refund failed");
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
        require(fileIds.length > 0, "No files");
        require(fileIds.length <= MAX_BATCH_SIZE, "Too many files");

        for (uint256 i = 0; i < fileIds.length; i++) {
            require(files[fileIds[i]].owner != address(0), "File does not exist");
            _recordDownload(fileIds[i], msg.sender);
        }

        emit BatchDownloaded(msg.sender, fileIds);
    }

    function _recordDownload(uint256 fileId, address downloader) internal {
        File storage file = files[fileId];
        _requireAvailable(fileId);
        require(file.owner == downloader || authorizedUsers[fileId][downloader], "Access not granted");
        require(!downloadHistory[fileId][downloader], "Already downloaded");

        file.downloadCount++;
        totalDownloads++;
        downloadHistory[fileId][downloader] = true;

        emit FileDownloaded(fileId, downloader, file.anonymousUpload ? address(0) : file.owner);
    }

    function createFolder(string calldata name, string calldata color) external returns (uint256 folderId) {
        require(bytes(name).length > 0, "Folder name required");

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
        require(folderId != 0, "Root folder cannot be updated");
        Folder storage folder = folders[folderId];
        require(folder.owner == msg.sender, "Not folder owner");
        require(bytes(name).length > 0, "Folder name required");

        folder.name = name;
        folder.color = color;
        folder.isActive = isActive;

        emit FolderUpdated(folderId, name, color, isActive);
    }

    function moveFileToFolder(uint256 fileId, uint256 folderId) external fileExists(fileId) onlyFileOwner(fileId) {
        _requireOwnedFolder(folderId, msg.sender);

        uint256 oldFolderId = files[fileId].folderId;
        if (oldFolderId == folderId) return;

        if (oldFolderId != 0 && folders[oldFolderId].fileCount > 0) {
            folders[oldFolderId].fileCount--;
        }
        if (folderId != 0) {
            folders[folderId].fileCount++;
        }

        files[fileId].folderId = folderId;
        emit FileMoved(fileId, oldFolderId, folderId);
    }

    function registerWebhook(
        bytes32 endpointHash,
        string calldata label,
        uint8 eventMask
    ) external returns (uint256 webhookId) {
        require(endpointHash != bytes32(0), "Endpoint hash required");
        require(eventMask > 0, "Event mask required");

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
        require(hook.owner == msg.sender, "Not webhook owner");
        require(endpointHash != bytes32(0), "Endpoint hash required");
        require(eventMask > 0, "Event mask required");

        hook.endpointHash = endpointHash;
        hook.label = label;
        hook.eventMask = eventMask;
        hook.isActive = isActive;

        emit WebhookUpdated(webhookId, endpointHash, eventMask, isActive);
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
        return (
            files[fileId].owner == msg.sender || authorizedUsers[fileId][msg.sender],
            downloadHistory[fileId][msg.sender]
        );
    }

    function getEncryptionInfo(uint256 fileId) external view fileExists(fileId) returns (
        bool contentEncrypted,
        bool isOwnerOrAuthorized
    ) {
        bool allowed = files[fileId].owner == msg.sender || authorizedUsers[fileId][msg.sender];
        return (files[fileId].contentEncrypted, allowed);
    }

    function getFileOwner(uint256 fileId) external view fileExists(fileId) returns (address) {
        if (files[fileId].anonymousUpload) return address(0);
        return files[fileId].owner;
    }

    function getFilePrivacy(uint256 fileId) external view fileExists(fileId) returns (
        bool anonymousUpload,
        address visibleOwner
    ) {
        File storage f = files[fileId];
        return (f.anonymousUpload, f.anonymousUpload ? address(0) : f.owner);
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

    function getFilesByFolder(uint256 folderId) external view returns (uint256[] memory fileIds) {
        uint256[] storage mine = userFiles[msg.sender];
        uint256 count;

        for (uint256 i = 0; i < mine.length; i++) {
            if (files[mine[i]].folderId == folderId) count++;
        }

        fileIds = new uint256[](count);
        uint256 cursor;
        for (uint256 i = 0; i < mine.length; i++) {
            if (files[mine[i]].folderId == folderId) {
                fileIds[cursor++] = mine[i];
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
        require(newPrice <= MAX_PRICE, "Price too high");

        File storage file = files[fileId];
        file.price = newPrice;
        file.maxDownloads = newMaxDownloads;
        file.expiresAt = newExpiryDays > 0 ? block.timestamp + (newExpiryDays * 1 days) : 0;
        file.accessCodeHash = newAccessCodeHash;
        file.hasPassword = newAccessCodeHash != bytes32(0);

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

    function getRemainingDownloads(uint256 fileId) public view fileExists(fileId) returns (uint256) {
        File storage f = files[fileId];
        if (f.maxDownloads == 0) return type(uint256).max;
        if (f.downloadCount >= f.maxDownloads) return 0;
        return f.maxDownloads - f.downloadCount;
    }

    function isFileExpired(uint256 fileId) public view fileExists(fileId) returns (bool) {
        uint256 exp = files[fileId].expiresAt;
        return exp > 0 && block.timestamp >= exp;
    }

    function getLatestFileId() external view returns (uint256) {
        uint256[] storage myFileIds = userFiles[msg.sender];
        require(myFileIds.length > 0, "No files found");
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
        require(IERC20(token).transfer(owner(), balance), "Transfer failed");
    }

    function _requireAvailable(uint256 fileId) internal view {
        File storage file = files[fileId];
        require(file.isActive, "File is not active");
        require(!isFileExpired(fileId), "File has expired");
        if (file.maxDownloads > 0) {
            require(file.downloadCount < file.maxDownloads, "No downloads remaining");
        }
    }

    function _requireOwnedFolder(uint256 folderId, address owner_) internal view {
        if (folderId == 0) return;
        require(folders[folderId].owner == owner_, "Invalid folder");
        require(folders[folderId].isActive, "Folder inactive");
    }
}
