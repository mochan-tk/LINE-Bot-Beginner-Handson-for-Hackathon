// playground:https://bicepdemo.z22.web.core.windows.net/
param location string = resourceGroup().location
param secret string
param access string
//param containerRegistryName string
param containerVer string
param gitRepository string
//param currentTime string = utcNow('yyyyMMddTHHmm')

var uniqueStr = uniqueString(resourceGroup().id)
var random = toLower(uniqueStr)
//var random = '${uniqueStr}${currentTime}'

//var storageAccountName = 'stacc${toLower(substring(replace(random, '-', ''), 0, 18))}'
var storageAccountName = 'stacc${replace(random, '-', '')}'

@description('That name is the name of our application. It has to be unique.Type a name followed by your resource group name. (<name>-<resourceGroupName>)')

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: true
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
    accessTier: 'Hot'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  name: 'default'
  parent: storageAccount
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: 'files'
  parent: blobService
  properties: {
    publicAccess:'Container'
  }
}

// https://docs.microsoft.com/en-us/azure/cosmos-db/sql/manage-with-bicep
var cosmosAccountName = 'cosmos-${toLower(random)}'
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    //enableFreeTier: true
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

var databaseName = 'SimpleDB'
resource cosmosDB 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

var cosmosContainerName = 'Accounts'
resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDB
  name: cosmosContainerName
  properties: {
    resource: {
      id: cosmosContainerName
      partitionKey: {
        paths: [
          '/partitionKey'
        ]
        kind: 'Hash'
      }
     }
     options:{}
    }
  }

// https://github.com/Azure-Samples/azure-data-factory-runtime-app-service/blob/ca44b7f23971c608a4e33020d130026a06f07788/deploy/modules/acr.bicep
@description('The name of the container registry to create. This must be globally unique.')
var containerRegistryName = 'acr${random}'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: containerRegistryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

var containerImageName = 'linebot/aca'
var containerImageTag = containerVer
var dockerfileSourceGitRepository = gitRepository
// https://learn.microsoft.com/en-us/azure/templates/microsoft.containerregistry/registries/taskruns
// https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-script-bicep
param guidValue string = newGuid()
resource buildTask 'Microsoft.ContainerRegistry/registries/taskRuns@2019-06-01-preview' = {
  parent: containerRegistry
  name: 'buildTask'
  properties: {
    forceUpdateTag: guidValue
    runRequest: {
      type: 'DockerBuildRequest'
      dockerFilePath: 'Dockerfile'
      sourceLocation: dockerfileSourceGitRepository
      imageNames: [
        '${containerImageName}:${containerImageTag}'
      ]
      platform: {
        os: 'Linux'
        architecture: 'amd64'
      }
      isPushEnabled: true
    }
  }
}

// https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.app/container-app-scale-http/main.bicep
@description('Specifies the name of the log analytics workspace.')
param containerAppLogAnalyticsName string = 'log-${uniqueString(resourceGroup().id)}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: containerAppLogAnalyticsName
  location: location
  properties: any({
    retentionInDays: 30
    features: {
      searchVersion: 1
    }
    sku: {
      name: 'PerGB2018'
    }
  })
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'AppInsights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId:logAnalytics.id
  }
}

resource managedEnvironments 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'capp-env'
  location: location
  properties: {
    daprAIInstrumentationKey: appInsights.properties.InstrumentationKey
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalytics.id, '2020-03-01-preview').customerId
        sharedKey: listKeys(logAnalytics.id, '2020-03-01-preview').primarySharedKey
      }
    }
  }
}

// https://learn.microsoft.com/ja-jp/dotnet/orleans/deployment/deploy-to-azure-container-apps
// https://github.com/microsoft/azure-container-apps/blob/main/docs/templates/bicep/main.bicep
var containerAppsName = 'capp-${toLower(random)}'
resource containerApps 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppsName
  location: location
  dependsOn: [
    buildTask
  ]
  properties: {
    managedEnvironmentId: managedEnvironments.id
    configuration: {
      registries: [
        {
          server: containerRegistry.properties.loginServer
          username: containerRegistry.listCredentials().username
          passwordSecretRef: 'reg-pswd-d6696fb9-a98d'
        }
      ]
      secrets: [
        {
          name: 'reg-pswd-d6696fb9-a98d'
          value: containerRegistry.listCredentials().passwords[0].value
        }
      ]
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        transport: 'auto'
        targetPort: 3000
      }
    }
    template: {
      containers: [
        {
          name: 'line-bot-container-apps'
          image: '${containerRegistry.name}.azurecr.io/${containerImageName}:${containerImageTag}'
          command: []
          resources: {
            cpu: json('0.5')
            memory: '1Gi'

          }
          env: [
            {
              name: 'CHANNEL_SECRET'
              value: secret
            }
            {
              name: 'CHANNEL_ACCESS_TOKEN'
              value: access
            }
            {
              name: 'STORAGE_CONNECTION_STRING'
              value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${listKeys(storageAccount.id, storageAccount.apiVersion).keys[0].value}'
            }
            {
              name: 'COSMOSDB_ACCOUNT'
              value: cosmosAccount.properties.documentEndpoint
            }
            {
              name: 'COSMOSDB_KEY'
              value: cosmosAccount.listKeys().primaryMasterKey
            }
            {
              name: 'COSMOSDB_DATABASENAME'
              value: cosmosDB.name
            }
            {
              name: 'COSMOSDB_CONTAINERNAME'
              value: cosmosContainer.name
            }
            {
              name: 'COSMOSDB_CONNECTION_STRING'
              value: 'AccountEndpoint=${cosmosAccount.properties.documentEndpoint};AccountKey=${cosmosAccount.listKeys().primaryMasterKey};'
            }
          ]
        }
      ]
      scale: {
        maxReplicas: 1
        minReplicas: 1
      }
    }
  }
}

output acaUrl string = 'https://${containerApps.properties.configuration.ingress.fqdn}'
