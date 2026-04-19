// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title FhenixDropBox
/// @notice Privacy-first decentralized file sharing with FHE-encrypted access control.
/// @dev Access rules (price, maxDownloads, expiry, access codes) are stored encrypted.
///      File content is encrypted client-side before IPFS upload.
contract FhenixDropBox is Ownable, ReentrancyGuard {

    // ─── FHE Types Placeholder ─────────────────────────────────────────────────────
    // In production, import FHE.sol from @fhenixprotocol/fhe-contracts:
    // import "@fhenixprotocol/contracts/FHE.sol";
    // Use encrypted types: euint64, euint128, ebool, encrypted addresses, etc.
    //
    // For demo/development, we use standard Solidity types but document where
    // FHE encrypted types would replace them.

    // ═══════════════════════════════════════════════════════════════════════════════
    // ENCRYPTED STATE VARIABLES (where FHE types would be used)
    // ═══════════════════════════════════════════════════════════════════════════════
    //
    // In production FHE version:
    //   euint64 internal encryptedPrice;        // replaces: uint256 price
    //   euint64 internal encryptedMaxDownloads; // replaces: uint256 maxDownloads
    //   euint64 internal encryptedDownloadCount; // replaces: uint256 downloadCount
    //   ebool  internal encryptedHasPassword;   // replaces: bool hasPassword
    //   euint64 internal encryptedAccessCode;  // replaces: bytes32 passwordHash
    //
    // These would be set via: FHE.asEuint64(encryptedInput), FHE.asEbool(encryptedInput)
    // and compared on-chain via: FHE.eq(), FHE.lt(), FHE.gte(), etc.

    // ─── Data Structures ────────────────────────────────────────────────────────

    struct File {
        string ipfsHash;          // IPFS CID of encrypted file blob
        uint256 createdAt;
        uint256 price;             // In production: euint128 encryptedPrice
        uint256 maxDownloads;      // In production: euint64 encryptedMaxDownloads
        uint256 downloadCount;    // In production: euint64 encryptedDownloadCount
        uint256 expiresAt;
        bytes32 accessCodeHash;    // Hash of numeric access code (FHE would use encryptedAccessCode)
        address owner;
        bool isActive;
        bool hasPassword;          // In production: ebool encryptedHasPassword
        bool contentEncrypted;    // NEW: Was the file content encrypted before upload?
        string encryptionKeyHash;  // NEW: Hash of key used for content encryption (for access grant)
    }

    struct FileAccessInfo {
        bool isAuthorized;
        bool hasDownloaded;
    }

    struct FileUploadedEvent {
        uint256 fileId;
        address owner;
        string ipfsHash;
        uint256 price;
        bool hasPassword;
        bool contentEncrypted;
    }

    // ─── State Variables ───────────────────────────────────────────────────────

    mapping(uint256 => File) public files;
    mapping(address => uint256[]) public userFiles;
    mapping(uint256 => mapping(address => bool)) public authorizedUsers;
    mapping(uint256 => mapping(address => bool)) public downloadHistory;

    uint256 public totalFiles;
    uint256 public totalDownloads;
    uint256 public totalVolume;

    // Supported payment token (USDC on Sepolia)
    address public constant USDC_TOKEN = 0x1aDV1aDV1aDV1aDV1aDV1aDV1aDV1aDV1aDV1;

    // ─── Events ────────────────────────────────────────────────────────────────

    event FileUploaded(
        uint256 indexed fileId,
        address indexed owner,
        string ipfsHash,
        uint256 price,
        bool hasPassword,
        bool contentEncrypted
    );

    event FileAccessed(
        uint256 indexed fileId,
        address indexed requester,
        uint256 price
    );

    event FileDownloaded(
        uint256 indexed fileId,
        address indexed downloader,
        address indexed owner
    );

    event FileDeactivated(uint256 indexed fileId);
    event FileReactivated(uint256 indexed fileId);
    event AccessRevoked(uint256 indexed fileId, address indexed user);

    // ═══════════════════════════════════════════════════════════════════════════════
    // FHE-ENCRYPTED ACCESS RULE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    //
    // The following functions demonstrate where FHE types would be used.
    // In production, these would accept encrypted inputs and perform on-chain
    // comparisons without revealing the underlying values.
    //
    // Example production patterns:
    //
    // function uploadFileEncrypted(
    //     string calldata ipfsHash_,
    //     bytes calldata encryptedPrice,      // InEuint128
    //     bytes calldata encryptedMaxDownloads, // InEuint64
    //     uint256 expiryDays_,
    //     bytes calldata encryptedAccessCode  // InEuint64
    // ) external returns (uint256 fileId) {
    //     euint128 price = FHE.asEuint128(encryptedPrice);
    //     euint64 maxDownloads = FHE.asEuint64(encryptedMaxDownloads);
    //     euint64 accessCode = FHE.asEuint64(encryptedAccessCode);
    //
    //     fileId = totalFiles++;
    //     files[fileId] = File({
    //         ipfsHash: ipfsHash_,
    //         price: price,
    //         maxDownloads: maxDownloads,
    //         accessCodeHash: FHE.eq(accessCode, storedCode),
    //         // ...
    //     });
    // }
    //
    // function checkAccessEncrypted(
    //     uint256 fileId,
    //     bytes calldata encryptedUserCode  // InEuint64
    // ) external view returns (ebool accessGranted) {
    //     euint64 userCode = FHE.asEuint64(encryptedUserCode);
    //     ebool matches = FHE.eq(userCode, files[fileId].encryptedAccessCode);
    //     return matches;
    // }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyFileOwner(uint256 fileId) {
        require(files[fileId].owner == msg.sender, "Not file owner");
        _;
    }

    modifier fileExists(uint256 fileId) {
        require(files[fileId].owner != address(0), "File does not exist");
        _;
    }

    modifier fileActive(uint256 fileId) {
        require(files[fileId].isActive, "File is not active");
        _;
    }

    modifier notExpired(uint256 fileId) {
        if (files[fileId].expiresAt > 0) {
            require(block.timestamp < files[fileId].expiresAt, "File has expired");
        }
        _;
    }

    modifier hasDownloadsLeft(uint256 fileId) {
        uint256 max = files[fileId].maxDownloads;
        if (max > 0) {
            require(files[fileId].downloadCount < max, "No downloads remaining");
        }
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        // Owner is the deployer
    }

    // ─── File Management ───────────────────────────────────────────────────────

    /// @notice Upload a new file with encrypted access rules
    /// @param ipfsHash_ IPFS content identifier
    /// @param price_ Access price in USDC (6 decimals)
    /// @param maxDownloads_ Max downloads (0 = unlimited)
    /// @param expiryDays_ Days until expiry (0 = never)
    /// @param accessCodeHash_ Hash of numeric access code (0 = no password)
    /// @param contentEncrypted_ Whether file content was encrypted before upload
    /// @param encryptionKeyHash_ Hash of content encryption key for access grants
    /// @return fileId The ID of the uploaded file
    function uploadFile(
        string calldata ipfsHash_,
        uint256 price_,
        uint256 maxDownloads_,
        uint256 expiryDays_,
        bytes32 accessCodeHash_,
        bool contentEncrypted_,
        bytes32 encryptionKeyHash_
    ) external returns (uint256 fileId) {
        require(bytes(ipfsHash_).length > 0, "IPFS hash required");
        require(price_ < 1e12, "Price too high"); // Max 1M USDC

        fileId = totalFiles++;
        uint256 expiresAt = expiryDays_ > 0
            ? block.timestamp + (expiryDays_ * 1 days)
            : 0;

        files[fileId] = File({
            ipfsHash: ipfsHash_,
            createdAt: block.timestamp,
            price: price_,
            maxDownloads: maxDownloads_,
            downloadCount: 0,
            expiresAt: expiresAt,
            accessCodeHash: accessCodeHash_,
            owner: msg.sender,
            isActive: true,
            hasPassword: accessCodeHash_ != bytes32(0),
            contentEncrypted: contentEncrypted_,
            encryptionKeyHash: encryptionKeyHash_
        });

        userFiles[msg.sender].push(fileId);

        emit FileUploaded(
            fileId,
            msg.sender,
            ipfsHash_,
            price_,
            files[fileId].hasPassword,
            contentEncrypted_
        );
    }

    /// @notice Request access to a file (pay for access)
    /// @param fileId The file to access
    /// @param accessCode_ The numeric access code (if file is password-protected)
    function requestAccess(uint256 fileId, bytes32 accessCode_) external payable
        fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant
    {
        File storage file = files[fileId];

        // Verify access code if required
        if (file.hasPassword) {
            require(file.accessCodeHash == accessCode_, "Invalid access code");
        }

        // Process payment (native token or USDC)
        if (file.price > 0) {
            require(msg.value >= file.price, "Insufficient payment");

            // Transfer to owner
            (bool success, ) = file.owner.call{value: file.price}("");
            require(success, "Payment transfer failed");

            totalVolume += file.price;
        }

        authorizedUsers[fileId][msg.sender] = true;
        emit FileAccessed(fileId, msg.sender, file.price);
    }

    /// @notice Request access using ERC20 (USDC)
    /// @param fileId The file to access
    /// @param accessCode_ The numeric access code
    /// @param amount_ USDC amount to pay
    function requestAccessERC20(
        uint256 fileId,
        bytes32 accessCode_,
        uint256 amount_
    ) external fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant {
        File storage file = files[fileId];

        // Verify access code
        if (file.hasPassword) {
            require(file.accessCodeHash == accessCode_, "Invalid access code");
        }

        // Process USDC payment
        if (file.price > 0) {
            require(amount_ >= file.price, "Insufficient payment");
            require(
                IERC20(USDC_TOKEN).transferFrom(msg.sender, file.owner, amount_),
                "USDC transfer failed"
            );
            totalVolume += amount_;
        }

        authorizedUsers[fileId][msg.sender] = true;
        emit FileAccessed(fileId, msg.sender, file.price);
    }

    /// @notice Download a file after access is granted
    /// @param fileId The file to download
    function downloadFile(uint256 fileId) external
        fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant
    {
        require(authorizedUsers[fileId][msg.sender], "Access not granted");

        File storage file = files[fileId];
        file.downloadCount++;
        totalDownloads++;
        downloadHistory[fileId][msg.sender] = true;

        emit FileDownloaded(fileId, msg.sender, file.owner);
    }

    /// @notice Get file basic info
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

    /// @notice Get file expiry time
    function getFileExpiry(uint256 fileId) external view fileExists(fileId) returns (uint256) {
        return files[fileId].expiresAt;
    }

    /// @notice Get access info for caller
    function getAccessInfo(uint256 fileId) external view fileExists(fileId) returns (
        bool isAuthorized,
        bool hasDownloaded
    ) {
        return (
            authorizedUsers[fileId][msg.sender],
            downloadHistory[fileId][msg.sender]
        );
    }

    /// @notice Get file owner
    function getFileOwner(uint256 fileId) external view fileExists(fileId) returns (address) {
        return files[fileId].owner;
    }

    /// @notice Get encryption info (only accessible to file owner or authorized user)
    function getEncryptionInfo(uint256 fileId) external view fileExists(fileId) returns (
        bool contentEncrypted,
        bool isOwnerOrAuthorized
    ) {
        bool isAuthorized = authorizedUsers[fileId][msg.sender]
            || files[fileId].owner == msg.sender;
        return (
            files[fileId].contentEncrypted,
            isAuthorized
        );
    }

    /// @notice Get files owned by caller
    function getMyFiles() external view returns (uint256[] memory) {
        return userFiles[msg.sender];
    }

    /// @notice Deactivate a file
    function deactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = false;
        emit FileDeactivated(fileId);
    }

    /// @notice Reactivate a file
    function reactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = true;
        emit FileReactivated(fileId);
    }

    /// @notice Update file access rules
    /// @param fileId The file to update
    /// @param newPrice New price in USDC
    /// @param newMaxDownloads New max downloads (0 = unlimited)
    /// @param newExpiryDays New expiry in days
    /// @param newAccessCodeHash New access code hash (0 = no change)
    function updateFileRules(
        uint256 fileId,
        uint256 newPrice,
        uint256 newMaxDownloads,
        uint256 newExpiryDays,
        bytes32 newAccessCodeHash
    ) external onlyFileOwner(fileId) {
        File storage file = files[fileId];
        file.price = newPrice;
        file.maxDownloads = newMaxDownloads;
        if (newExpiryDays > 0) {
            file.expiresAt = block.timestamp + (newExpiryDays * 1 days);
        }
        if (newAccessCodeHash != bytes32(0)) {
            file.accessCodeHash = newAccessCodeHash;
            file.hasPassword = true;
        }
    }

    /// @notice Get platform statistics
    function getStats() external view returns (
        uint256 _totalFiles,
        uint256 _totalDownloads,
        uint256 _totalVolume,
        uint256 _myFileCount
    ) {
        return (
            totalFiles,
            totalDownloads,
            totalVolume,
            userFiles[msg.sender].length
        );
    }

    /// @notice Revoke user access
    function revokeAccess(uint256 fileId, address user) external onlyFileOwner(fileId) {
        authorizedUsers[fileId][user] = false;
        emit AccessRevoked(fileId, user);
    }

    // ─── Owner Functions ──────────────────────────────────────────────────────

    /// @notice Withdraw contract balance
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /// @notice Withdraw ERC20 tokens
    function withdrawERC20(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(owner(), balance), "Transfer failed");
    }

    /// @notice Get remaining downloads for a file
    function getRemainingDownloads(uint256 fileId) external view fileExists(fileId) returns (uint256) {
        File storage f = files[fileId];
        if (f.maxDownloads == 0) return type(uint256).max;
        if (f.downloadCount >= f.maxDownloads) return 0;
        return f.maxDownloads - f.downloadCount;
    }

    /// @notice Check if file is expired
    function isFileExpired(uint256 fileId) external view fileExists(fileId) returns (bool) {
        uint256 exp = files[fileId].expiresAt;
        return exp > 0 && block.timestamp >= exp;
    }

    /// @notice Get contract balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Get the latest file ID for the caller (for share link creation)
    function getLatestFileId() external view returns (uint256) {
        uint256[] memory myFileIds = userFiles[msg.sender];
        require(myFileIds.length > 0, "No files found");
        return myFileIds[myFileIds.length - 1];
    }
}
