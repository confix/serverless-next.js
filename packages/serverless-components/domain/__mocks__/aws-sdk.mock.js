const promisifyMock = (mockFn) => {
  const promise = jest.fn();
  mockFn.mockImplementation(() => ({
    promise
  }));

  return promise;
};

const mockListHostedZonesByName = jest.fn();
const mockListHostedZonesByNamePromise = promisifyMock(
  mockListHostedZonesByName
);

const mockChangeResourceRecordSets = jest.fn();
const mockChangeResourceRecordSetsPromise = promisifyMock(
  mockChangeResourceRecordSets
);

const mockDescribeCertificate = jest.fn();
const mockDescribeCertificatePromise = promisifyMock(mockDescribeCertificate);

const mockListCertificates = jest.fn();
const mockListCertificatesPromise = promisifyMock(mockListCertificates);

const mockRequestCertificate = jest.fn();
const mockRequestCertificatePromise = promisifyMock(mockRequestCertificate);

const mockGetDistributionConfig = jest.fn();
const mockGetDistributionConfigPromise = promisifyMock(
  mockGetDistributionConfig
);

const mockUpdateDistribution = jest.fn();
const mockUpdateDistributionPromise = promisifyMock(mockUpdateDistribution);

const mockListResourceRecordSets = jest.fn();
const mockListResourceRecordSetsPromise = promisifyMock(
  mockListResourceRecordSets
);

module.exports = {
  mockListHostedZonesByName,
  mockListHostedZonesByNamePromise,
  mockChangeResourceRecordSets,
  mockChangeResourceRecordSetsPromise,
  mockDescribeCertificate,
  mockDescribeCertificatePromise,
  mockListCertificates,
  mockListCertificatesPromise,
  mockRequestCertificate,
  mockRequestCertificatePromise,
  mockGetDistributionConfig,
  mockGetDistributionConfigPromise,
  mockUpdateDistribution,
  mockUpdateDistributionPromise,
  mockListResourceRecordSets,
  mockListResourceRecordSetsPromise,

  Route53: jest.fn(() => ({
    listHostedZonesByName: mockListHostedZonesByName,
    changeResourceRecordSets: mockChangeResourceRecordSets,
    listResourceRecordSets: mockListResourceRecordSets
  })),
  ACM: jest.fn(() => ({
    describeCertificate: mockDescribeCertificate,
    listCertificates: mockListCertificates,
    requestCertificate: mockRequestCertificate
  })),
  CloudFront: jest.fn(() => ({
    getDistributionConfig: mockGetDistributionConfig,
    updateDistribution: mockUpdateDistribution
  }))
};
