// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CivicProof
/// @notice Minimal public civic-report register for a hackathon prototype.
/// @dev Report text is public on-chain. Never submit personal or sensitive data.
contract CivicProof {
    enum Status { Submitted, UnderReview, Resolved }

    struct Report {
        uint256 id;
        address reporter;
        string category;
        string location;
        string description;
        bytes32 evidenceHash;
        Status status;
        uint256 createdAt;
    }

    uint256 public reportCount;
    mapping(uint256 => Report) public reports;

    event ReportSubmitted(
        uint256 indexed reportId,
        address indexed reporter,
        string category,
        string location,
        bytes32 evidenceHash,
        uint256 createdAt
    );

    event StatusUpdated(
        uint256 indexed reportId,
        Status status,
        address indexed updatedBy
    );

    error EmptyField();
    error ReportNotFound();
    error OnlyReporterCanUpdate();

    /// @notice Create a public report. The evidence image itself is not stored.
    function submitReport(
        string calldata category,
        string calldata location,
        string calldata description,
        bytes32 evidenceHash
    ) external returns (uint256) {
        if (
            bytes(category).length == 0 ||
            bytes(location).length == 0 ||
            bytes(description).length == 0
        ) revert EmptyField();

        uint256 id = ++reportCount;
        reports[id] = Report({
            id: id,
            reporter: msg.sender,
            category: category,
            location: location,
            description: description,
            evidenceHash: evidenceHash,
            status: Status.Submitted,
            createdAt: block.timestamp
        });

        emit ReportSubmitted(
            id, msg.sender, category, location, evidenceHash, block.timestamp
        );
        return id;
    }

    /// @notice Prototype workflow: only the original reporter can advance status.
    /// @dev Production systems should use verified municipal/authority roles.
    function updateStatus(uint256 reportId, uint8 newStatus) external {
        if (reportId == 0 || reportId > reportCount) revert ReportNotFound();
        Report storage report = reports[reportId];
        if (msg.sender != report.reporter) revert OnlyReporterCanUpdate();
        if (newStatus != uint8(report.status) + 1 || newStatus > uint8(Status.Resolved)) {
            revert EmptyField();
        }

        report.status = Status(newStatus);
        emit StatusUpdated(reportId, report.status, msg.sender);
    }
}
