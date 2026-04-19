// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FhenixDropBox
 * @dev Privacy-first decentralized file sharing with encrypted access control.
 *      Uses placeholder encrypted types that can be replaced with Fhenix FHE types
 *      when deploying to Fhenix network.
 *
 *      IMPORTANT: This is a mock implementation demonstrating the architecture.
 *      For production use on Fhenix, replace encrypted types with actual FHE types
 *      from @fhenixprotocol/contracts library.
 */
contract FhenixDropBox is Ownable, ReentrancyGuard {

    // ─── Data Structures ────────────────────────────────────────────────────────

    struct File {
        string ipfsHash;
        uint256 createdAt;
        uint256 price;              // Price in smallest unit (e.g., wei for USDC)
        uint256 maxDownloads;
        uint256 downloadCount;
        uint256 expiresAt;
        bytes32 passwordHash;       // Keccak256 hash of password (placeholder for FHE)
        address owner;
        bool isActive;
        bool hasPassword;
    }

    struct AccessRequest {
        address requester;
        uint256 fileId;
        bool granted;
        uint256 timestamp;
    }

    // ─── State Variables ────────────────────────────────────────────────────────

    // File storage
    mapping(uint256 => File) public files;
    mapping(address => uint256[]) public userFiles;
    mapping(uint256 => mapping(address => bool)) public authorizedUsers;
    mapping(uint256 => mapping(address => bool)) public downloadHistory;

    // Statistics
    uint256 public totalFiles;
    uint256 public totalDownloads;
    uint256 public totalVolume;      // Total volume in wei/USDC

    // Access control
    mapping(address => bool) public authorizedFileCreator;

    // ─── Events ────────────────────────────────────────────────────────────────

    event FileUploaded(
        uint256 indexed fileId,
        address indexed owner,
        string ipfsHash,
        uint256 price,
        bool hasPassword
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

    event AccessRevoked(
        uint256 indexed fileId,
        address indexed user
    );

    event FileDeactivated(
        uint256 indexed fileId
    );

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
        if (files[fileId].maxDownloads > 0) {
            require(
                files[fileId].downloadCount < files[fileId].maxDownloads,
                "No downloads remaining"
            );
        }
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {
        authorizedFileCreator[msg.sender] = true;
    }

    // ─── File Management ──────────────────────────────────────────────────────

    /**
     * @dev Upload a new file with encrypted access rules
     *      In production Fhenix implementation, price and other values
     *      would be encrypted types
     *
     * @param ipfsHash_ IPFS content identifier
     * @param price_ Access price (placeholder - would be euint64 in FHE)
     * @param maxDownloads_ Maximum number of downloads allowed (0 = unlimited)
     * @param expiryDays_ Number of days until expiry (0 = never expires)
     * @param passwordHash_ Hash of password (empty = no password)
     */
    function uploadFile(
        string calldata ipfsHash_,
        uint256 price_,
        uint256 maxDownloads_,
        uint256 expiryDays_,
        bytes32 passwordHash_
    ) external returns (uint256) {
        require(bytes(ipfsHash_).length > 0, "IPFS hash required");
        require(price_ >= 0, "Price cannot be negative");

        uint256 fileId = totalFiles++;
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
            passwordHash: passwordHash_,
            owner: msg.sender,
            isActive: true,
            hasPassword: passwordHash_ != bytes32(0)
        });

        userFiles[msg.sender].push(fileId);

        emit FileUploaded(fileId, msg.sender, ipfsHash_, price_, passwordHash_ != bytes32(0));

        return fileId;
    }

    /**
     * @dev Request access to a file (payment verification would happen here)
     *
     * In production FHE implementation:
     * - Price comparison would happen on encrypted values
     * - Payment verification would be private
     */
    function requestAccess(
        uint256 fileId
    ) external payable fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant {
        File storage file = files[fileId];

        // If file has a price, verify payment
        if (file.price > 0) {
            require(msg.value >= file.price, "Insufficient payment");

            // Transfer payment to owner (minus platform fee if applicable)
            uint256 ownerPayment = file.price;
            (bool success, ) = file.owner.call{value: ownerPayment}("");
            require(success, "Payment transfer failed");

            totalVolume += file.price;
        }

        // Grant access
        authorizedUsers[fileId][msg.sender] = true;

        emit FileAccessed(fileId, msg.sender, file.price);
    }

    /**
     * @dev Verify password for a file with password protection
     *      In FHE implementation, this would use encrypted comparison
     */
    function verifyPassword(
        uint256 fileId,
        string calldata password
    ) external view fileExists(fileId) fileActive(fileId) returns (bool) {
        File storage file = files[fileId];

        if (!file.hasPassword) {
            return true; // No password required
        }

        return keccak256(abi.encodePacked(password)) == file.passwordHash;
    }

    /**
     * @dev Download a file after access has been granted
     */
    function downloadFile(
        uint256 fileId
    ) external fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant {
        File storage file = files[fileId];

        // Verify access has been granted
        require(authorizedUsers[fileId][msg.sender], "Access not granted");

        // Check password if required (this is a simplified check)
        // In production, password verification would happen during requestAccess

        // Increment download count
        file.downloadCount++;
        totalDownloads++;

        // Record download history
        downloadHistory[fileId][msg.sender] = true;

        emit FileDownloaded(fileId, msg.sender, file.owner);
    }

    /**
     * @dev Get file details including access status for caller
     */
    function getFileDetails(uint256 fileId) external view returns (
        string memory ipfsHash,
        uint256 createdAt,
        uint256 price,
        uint256 maxDownloads,
        uint256 downloadCount,
        uint256 expiresAt,
        bool isActive,
        bool hasPassword,
        bool isAuthorized,
        bool hasDownloaded
    ) {
        File storage file = files[fileId];
        return (
            file.ipfsHash,
            file.createdAt,
            file.price,           // In FHE, this would be encrypted
            file.maxDownloads,    // In FHE, this would be encrypted
            file.downloadCount,
            file.expiresAt,       // In FHE, this would be encrypted
            file.isActive,
            file.hasPassword,
            authorizedUsers[fileId][msg.sender],
            downloadHistory[fileId][msg.sender]
        );
    }

    /**
     * @dev Get files owned by the caller
     */
    function getMyFiles() external view returns (uint256[] memory) {
        return userFiles[msg.sender];
    }

    /**
     * @dev Deactivate a file (doesn't delete, just makes inaccessible)
     */
    function deactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = false;
        emit FileDeactivated(fileId);
    }

    /**
     * @dev Reactivate a file
     */
    function reactivateFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isActive = true;
    }

    /**
     * @dev Update file access rules
     */
    function updateFileRules(
        uint256 fileId,
        uint256 newPrice,
        uint256 newMaxDownloads,
        uint256 newExpiryDays
    ) external onlyFileOwner(fileId) {
        File storage file = files[fileId];

        file.price = newPrice;
        file.maxDownloads = newMaxDownloads;

        if (newExpiryDays > 0) {
            file.expiresAt = block.timestamp + (newExpiryDays * 1 days);
        }
    }

    /**
     * @dev Get platform statistics
     */
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

    // ─── Owner Functions ────────────────────────────────────────────────────────

    /**
     * @dev Authorize a new file creator (for access control)
     */
    function authorizeCreator(address creator) external onlyOwner {
        authorizedFileCreator[creator] = true;
    }

    /**
     * @dev Revoke creator authorization
     */
    function revokeCreator(address creator) external onlyOwner {
        authorizedFileCreator[creator] = false;
    }

    /**
     * @dev Withdraw contract balance (for platform fees)
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // ─── View Functions (FHE Placeholders) ────────────────────────────────────

    /**
     * @dev These functions demonstrate where FHE encrypted values would be used
     *      In a production FHE implementation, return types would be encrypted types
     */

    function getEncryptedPrice(uint256 fileId) external view returns (uint256) {
        return files[fileId].price; // Would return encrypted euint64 in FHE
    }

    function getEncryptedMaxDownloads(uint256 fileId) external view returns (uint256) {
        return files[fileId].maxDownloads; // Would return encrypted euint64 in FHE
    }

    function getEncryptedExpiryTime(uint256 fileId) external view returns (uint256) {
        return files[fileId].expiresAt; // Would return encrypted euint64 in FHE
    }

    /**
     * @dev Compare encrypted values (placeholder for FHE operations)
     *      In production, this would compare encrypted euint64 values
     */
    function compareEncryptedValues(
        uint256 a,
        uint256 b
    ) external pure returns (bool) {
        return a == b; // FHE would handle this on encrypted data
    }
}
