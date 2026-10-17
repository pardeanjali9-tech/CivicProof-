# CivicProof — From complaint to verified repair

A responsive hackathon prototype for transparent civic-issue reporting. It includes a web frontend, MetaMask connection, a Solidity contract, on-chain report submission and status updates, and local preview mode.

## What works

- Responsive, professional dark UI.
- Civic report form with category, general location, description, optional image.
- Browser-only preview mode so you can test the UI without paying gas.
- MetaMask connection and Sepolia network check.
- SHA-256 evidence fingerprint generated in the browser.
- Smart-contract submission through MetaMask, with transaction confirmation.
- Reads existing contract reports and shows status.
- Status transitions: Submitted → Under Review → Resolved.

## Important limitations

- A deployed contract is **not included** because deployment must be performed from your wallet.
- Until you deploy the contract and configure its address, submissions are local browser demo records only.
- This prototype uses Ethereum Sepolia testnet. Test ETH has no real-world value; never share your recovery phrase or private key.
- Contract report text and locations are public and permanent on-chain. Use only non-sensitive, general location descriptions.
- The image itself is not uploaded or stored. The app hashes the selected image locally and stores only a fingerprint.
- The prototype permits the original reporter to advance their own status for demo purposes. A real deployment needs authorized municipal reviewers, anti-abuse protections, and privacy/legal review.
- This is a demonstration, not a production civic service.

## A. Run the website

1. Extract the ZIP to a folder such as `Desktop/CivicProof`.
2. Open the folder in VS Code.
3. Install the VS Code **Live Server** extension if you don't already have it.
4. Right-click `index.html` → **Open with Live Server**.
5. The app should open at a localhost address. Internet access is needed for the Ethers.js CDN.
6. Try submitting a report without connecting MetaMask. It should save in local demo mode.

If the app is blank, open the browser developer console with `F12` and inspect Console for a missing file or CDN error. Check that `index.html`, `style.css`, and `app.js` are all in the same folder.

## B. Install and connect MetaMask

1. Install MetaMask only from its official website: https://metamask.io/
2. Create or unlock your wallet locally. **Never share your recovery phrase/private key with anyone or enter it into this project.**
3. Switch to **Ethereum Sepolia** test network in MetaMask. If it isn't available, enable test networks in MetaMask settings.
4. Get Sepolia test ETH from a reputable faucet linked from the official Ethereum developer documentation. Do not pay anyone for test ETH.

## C. Deploy the Solidity contract

1. Open https://remix.ethereum.org/
2. Create `CivicProof.sol` and paste the contents of `contracts/CivicProof.sol`.
3. In **Solidity Compiler**, choose compiler `0.8.24` or a compatible `0.8.x`, then compile.
4. In **Deploy & Run Transactions**, choose **Injected Provider - MetaMask** and confirm MetaMask is connected to Sepolia.
5. Confirm the account and network are correct. Click **Deploy**, then approve the transaction in MetaMask.
6. After deployment is confirmed, copy the deployed contract address from Remix. Keep the contract deployed on Sepolia.

## D. Connect the website to your contract

1. Open `app.js` in VS Code.
2. At the top, replace the empty address in this line with the exact address copied from Remix:

   `const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";`

3. Save `app.js` and refresh the website.
4. Click **Connect MetaMask** and approve the connection.
5. Ensure MetaMask is on **Sepolia** and has a small amount of Sepolia test ETH for gas.
6. Fill in a test report and leave **Submit on-chain using MetaMask when connected** checked.
7. Click **Create report**, approve the transaction in MetaMask, and wait for confirmation. The report should then appear in the list.

If you uncheck the on-chain option, it creates a local-only demo report instead.

## E. Demo checklist

- Show the landing page and the three-step flow.
- Submit one sample issue using a general location (no personal data).
- Connect MetaMask and show the wallet address.
- Submit a report on Sepolia and wait for confirmation.
- Open the evidence hash.
- Advance status once or twice and show that each update asks MetaMask to confirm a transaction.
- Explain honestly that Sepolia is a testnet and that production requires authority verification, privacy safeguards, and a more robust role model.

## Troubleshooting

- **MetaMask not detected:** install/enable the official extension, reload the localhost page, and ensure the browser extension is unlocked.
- **Wrong network:** switch MetaMask to Sepolia.
- **Contract address not configured:** paste the deployed contract address into `app.js`, save, and refresh.
- **Transaction fails:** check test ETH, selected network, and contract address.
- **Ethers.js unavailable:** check internet connectivity; the HTML loads it from a CDN.
- **Local file does not connect to MetaMask:** use Live Server (`http://127.0.0.1:5500`) rather than opening the HTML directly.
- **Reports do not appear:** click Refresh; verify the correct contract address/network. The contract read loop is intended for small hackathon demos.

## Project structure

```text
CivicProof/
├── index.html
├── style.css
├── app.js
├── README.md
└── contracts/
    └── CivicProof.sol
```
