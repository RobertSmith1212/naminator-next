1. A Hardcoded env.local should never be committed becuase of the secrets inside. It should be treated just like a env file, and put in the gitignore.

2. The GitHub secrets can only be found in GitHub, which means you need the account of the person who owns the repo to get into the secrets, instead of them just being in the code editor.

3. If you hardcoded a value into the yml file then it would be a huge security risk. The DATABASE_URL needs to be kept secure in the GitHub secrets or in the env file. Leaving it in the public workflow file would not be proper secret security.