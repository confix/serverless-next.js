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

module.exports = {
  mockListHostedZonesByName,
  mockListHostedZonesByNamePromise,
  mockChangeResourceRecordSets,
  mockChangeResourceRecordSetsPromise,
  mockDescribeCertificate,
  mockDescribeCertificatePromise,
  mockRequestCertificate,
  mockRequestCertificatePromise,

  Route53: jest.fn(() => ({
    listHostedZonesByName: mockListHostedZonesByName,
    changeResourceRecordSets: mockChangeResourceRecordSets
  })),
  ACM: jest.fn(() => ({
    describeCertificate: mockDescribeCertificate,
    listCertificates: mockListCertificates,
    requestCertificate: mockRequestCertificate
  }))
};
