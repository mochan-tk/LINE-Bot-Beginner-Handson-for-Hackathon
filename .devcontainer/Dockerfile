# copy: https://github.com/microsoft/vscode-dev-containers/blob/main/containers/azure-functions-node/.devcontainer/Dockerfile
# Find the Dockerfile at the following URL:
# Node 14: https://github.com/Azure/azure-functions-docker/blob/dev/host/4/bullseye/amd64/node/node14/node14-core-tools.Dockerfile
# Node 16: https://github.com/Azure/azure-functions-docker/blob/dev/host/4/bullseye/amd64/node/node16/node16-core-tools.Dockerfile
# Node 18: https://github.com/Azure/azure-functions-docker/blob/dev/host/4/bullseye/amd64/node/node18/node18-core-tools.Dockerfile
ARG VARIANT=20
FROM mcr.microsoft.com/azure-functions/node:4-node${VARIANT}-core-tools

RUN curl -Lo /usr/local/bin/bicep https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64 \
    && chmod +x /usr/local/bin/bicep 

# Install uv (which provides uvx) for the codespace user
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to run your Function locally with 
# local.settings.json using `"AzureWebJobsStorage": "UseDevelopmentStorage=true"`
# RUN sudo -u node npm install -g azurite

# [Optional] Uncomment if you want to install more global node packages
# RUN sudo -u node npm install -g <your-package-list-here>
