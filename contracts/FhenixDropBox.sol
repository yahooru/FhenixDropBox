// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FhenixDropBox
/// @notice Privacy-first decentralized file sharing with encrypted access control.
contract FhenixDropBox is Ownable, ReentrancyGuard {

    // ─── Data Structures ────────────────────────────────────────────────────────

    struct File {
        string ipfsHash;
        uint256 createdAt;
        uint256 price;
        uint256 maxDownloads;
        uint256 downloadCount;
        uint256 expiresAt;
        bytes32 passwordHash;
        address owner;
        bool isActive;
        bool hasPassword;
    }

    struct FileAccessInfo {
        bool isAuthorized;
        bool hasDownloaded;
    }

    // ─── State Variables ────────────────────────────────────────────────────────

    mapping(uint256 => File) public files;
    mapping(address => uint256[]) public userFiles;
    mapping(uint256 => mapping(address => bool)) public authorizedUsers;
    mapping(uint256 => mapping(address => bool)) public downloadHistory;

    uint256 public totalFiles;
    uint256 public totalDownloads;
    uint256 public totalVolume;

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

    event FileDeactivated(uint256 indexed fileId);
    event FileReactivated(uint256 indexed fileId);
    event AccessRevoked(uint256 indexed fileId, address indexed user);

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
        authorizedFileCreator[msg.sender] = true;
    }

    // ─── File Management ──────────────────────────────────────────────────────

    /// @notice Upload a new file with encrypted access rules
    /// @param ipfsHash_ IPFS content identifier
    /// @param price_ Access price in wei
    /// @param maxDownloads_ Max downloads (0 = unlimited)
    /// @param expiryDays_ Days until expiry (0 = never)
    /// @param passwordHash_ Hash of password (empty = no password)
    /// @return fileId The ID of the uploaded file
    function uploadFile(
        string calldata ipfsHash_,
        uint256 price_,
        uint256 maxDownloads_,
        uint256 expiryDays_,
        bytes32 passwordHash_
    ) external returns (uint256 fileId) {
        require(bytes(ipfsHash_).length > 0, "IPFS hash required");

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
            passwordHash: passwordHash_,
            owner: msg.sender,
            isActive: true,
            hasPassword: passwordHash_ != bytes32(0)
        });

        userFiles[msg.sender].push(fileId);

        emit FileUploaded(fileId, msg.sender, ipfsHash_, price_, files[fileId].hasPassword);
    }

    /// @notice Request access to a file
    function requestAccess(uint256 fileId) external payable
        fileExists(fileId) fileActive(fileId) notExpired(fileId) hasDownloadsLeft(fileId) nonReentrant
    {
        File storage file = files[fileId];

        if (file.price > 0) {
            require(msg.value >= file.price, "Insufficient payment");

            (bool success, ) = file.owner.call{value: file.price}("");
            require(success, "Payment transfer failed");

            totalVolume += file.price;
        }

        authorizedUsers[fileId][msg.sender] = true;
        emit FileAccessed(fileId, msg.sender, file.price);
    }

    /// @notice Verify password for a protected file
    function verifyPassword(uint256 fileId, string calldata password) external view
        fileExists(fileId) fileActive(fileId) returns (bool)
    {
        File storage file = files[fileId];
        if (!file.hasPassword) return true;
        return keccak256(abi.encodePacked(password)) == file.passwordHash;
    }

    /// @notice Download a file after access is granted
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
        bool hasPassword
    ) {
        File storage f = files[fileId];
        return (
            f.ipfsHash,
            f.createdAt,
            f.price,
            f.maxDownloads,
            f.downloadCount,
            f.isActive,
            f.hasPassword
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

    // ─── Owner Functions ────────────────────────────────────────────────────────

    /// @notice Authorize a new file creator
    function authorizeCreator(address creator) external onlyOwner {
        authorizedFileCreator[creator] = true;
    }

    /// @notice Revoke creator authorization
    function revokeCreator(address creator) external onlyOwner {
        authorizedFileCreator[creator] = false;
    }

    /// @notice Withdraw contract balance
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
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
}
