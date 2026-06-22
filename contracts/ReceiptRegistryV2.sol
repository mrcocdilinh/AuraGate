// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReceiptRegistryV2 {
    struct Receipt {
        address payer;
        address seller;
        address asset;
        bytes32 serviceId;
        bytes32 requestHash;
        bytes32 resultHash;
        bytes32 settlementRef;
        uint256 amount;
        uint256 chainId;
        uint64 timestamp;
    }

    address public owner;
    mapping(address => bool) public recorders;
    mapping(bytes32 => bool) public settlementRecorded;
    Receipt[] public receipts;

    event RecorderUpdated(address indexed recorder, bool allowed);
    event ReceiptRecordedV2(
        uint256 indexed id,
        address indexed payer,
        address indexed seller,
        bytes32 serviceId,
        address asset,
        uint256 amount,
        bytes32 requestHash,
        bytes32 resultHash,
        bytes32 settlementRef,
        uint256 chainId
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyRecorder() {
        require(recorders[msg.sender], "not recorder");
        _;
    }

    constructor(address initialRecorder) {
        owner = msg.sender;
        recorders[msg.sender] = true;
        if (initialRecorder != address(0)) {
            recorders[initialRecorder] = true;
            emit RecorderUpdated(initialRecorder, true);
        }
        emit RecorderUpdated(msg.sender, true);
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        require(recorder != address(0), "zero recorder");
        recorders[recorder] = allowed;
        emit RecorderUpdated(recorder, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    function recordReceipt(
        address payer,
        address seller,
        address asset,
        bytes32 serviceId,
        bytes32 requestHash,
        bytes32 resultHash,
        bytes32 settlementRef,
        uint256 amount
    ) external onlyRecorder returns (uint256 id) {
        require(payer != address(0), "zero payer");
        require(seller != address(0), "zero seller");
        require(asset != address(0), "zero asset");
        require(amount > 0, "zero amount");
        require(resultHash != bytes32(0), "zero result");

        if (settlementRef != bytes32(0)) {
            require(!settlementRecorded[settlementRef], "duplicate settlement");
            settlementRecorded[settlementRef] = true;
        }

        id = receipts.length;
        receipts.push(
            Receipt({
                payer: payer,
                seller: seller,
                asset: asset,
                serviceId: serviceId,
                requestHash: requestHash,
                resultHash: resultHash,
                settlementRef: settlementRef,
                amount: amount,
                chainId: block.chainid,
                timestamp: uint64(block.timestamp)
            })
        );

        emit ReceiptRecordedV2(
            id,
            payer,
            seller,
            serviceId,
            asset,
            amount,
            requestHash,
            resultHash,
            settlementRef,
            block.chainid
        );
    }

    function total() external view returns (uint256) {
        return receipts.length;
    }
}
